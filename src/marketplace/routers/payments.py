import logging
import uuid

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user
from ..config import get_settings
from ..database import get_session
from ..models import AgentProfile, CreditPack, CreditPurchase, CreatorEarnings, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


def _get_stripe():
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(503, "Stripe not configured")
    stripe.api_key = settings.stripe_secret_key
    return stripe


# ── Schemas ───────────────────────────────────────────────────────────


class CheckoutRequest(BaseModel):
    pack_id: str


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class BalanceResponse(BaseModel):
    credit_balance: int


class PurchaseHistoryItem(BaseModel):
    id: str
    pack_id: str | None
    pack_name: str | None
    credits_granted: int
    amount_paid_cents: int
    status: str
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────────


@router.get("/credit-packs")
def list_credit_packs(session: Session = Depends(get_session)):
    """Public endpoint — list all active credit packs."""
    packs = session.exec(
        select(CreditPack).where(CreditPack.is_active == True).order_by(CreditPack.price_cents)  # noqa: E712
    ).all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "credits": p.credits,
            "price_cents": p.price_cents,
            "bonus_credits": p.bonus_credits,
            "total_credits": p.credits + p.bonus_credits,
            "stripe_price_id": p.stripe_price_id,
        }
        for p in packs
    ]


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout_session(
    body: CheckoutRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Create a Stripe Checkout session for a credit pack purchase."""
    _get_stripe()
    settings = get_settings()

    pack = session.get(CreditPack, uuid.UUID(body.pack_id))
    if not pack or not pack.is_active:
        raise HTTPException(404, "Credit pack not found or inactive")

    # Ensure Stripe customer exists
    customer_id = user.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.display_name or user.email,
            metadata={"user_id": str(user.id)},
        )
        customer_id = customer.id
        user.stripe_customer_id = customer_id
        session.add(user)
        session.commit()

    total_credits = pack.credits + pack.bonus_credits
    checkout_session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": pack.price_cents,
                    "product_data": {
                        "name": f"SWARM Credits — {pack.name}",
                        "description": f"{total_credits:,} credits ({pack.credits:,} + {pack.bonus_credits:,} bonus)",
                    },
                },
                "quantity": 1,
            }
        ],
        mode="payment",
        success_url=f"{settings.frontend_origin}/credits/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.frontend_origin}/credits",
        metadata={
            "user_id": str(user.id),
            "pack_id": str(pack.id),
            "credits": str(total_credits),
        },
    )

    # Create pending purchase record
    purchase = CreditPurchase(
        user_id=user.id,
        pack_id=pack.id,
        stripe_session_id=checkout_session.id,
        credits_granted=total_credits,
        amount_paid_cents=pack.price_cents,
        status="pending",
    )
    session.add(purchase)
    session.commit()

    return CheckoutResponse(
        checkout_url=checkout_session.url,
        session_id=checkout_session.id,
    )


@router.post("/webhook")
async def stripe_webhook(request: Request, session: Session = Depends(get_session)):
    """Stripe webhook handler — verifies signature and grants credits on payment."""
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise HTTPException(503, "Webhook secret not configured")

    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid webhook signature")
    except Exception as e:
        raise HTTPException(400, f"Webhook error: {e}")

    if event["type"] == "checkout.session.completed":
        checkout_session = event["data"]["object"]
        session_id = checkout_session["id"]

        # Find purchase record
        purchase = session.exec(
            select(CreditPurchase).where(CreditPurchase.stripe_session_id == session_id)
        ).first()

        if not purchase:
            logger.warning(f"Webhook: no purchase found for session {session_id}")
            return {"status": "ignored"}

        if purchase.status == "completed":
            return {"status": "already_processed"}

        # Update payment intent
        payment_intent = checkout_session.get("payment_intent")
        if payment_intent:
            purchase.stripe_payment_intent_id = payment_intent

        # Grant credits atomically
        buyer = session.get(User, purchase.user_id)
        if not buyer:
            logger.error(f"Webhook: user {purchase.user_id} not found")
            return {"status": "error", "detail": "user not found"}

        buyer.credit_balance += purchase.credits_granted
        purchase.status = "completed"

        session.add(buyer)
        session.add(purchase)
        session.commit()

        logger.info(
            f"Granted {purchase.credits_granted} credits to user {buyer.id} "
            f"(session {session_id})"
        )

    return {"status": "ok"}


@router.get("/balance", response_model=BalanceResponse)
def get_balance(user: User = Depends(get_current_user)):
    """Return current user's credit balance."""
    return BalanceResponse(credit_balance=user.credit_balance)


@router.get("/history")
def get_purchase_history(
    page: int = 1,
    limit: int = 20,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Paginated credit purchase history for the current user."""
    offset = (page - 1) * limit
    purchases = session.exec(
        select(CreditPurchase)
        .where(CreditPurchase.user_id == user.id)
        .order_by(CreditPurchase.created_at.desc())  # type: ignore[union-attr]
        .offset(offset)
        .limit(limit)
    ).all()

    result = []
    for p in purchases:
        pack_name = None
        if p.pack_id:
            pack = session.get(CreditPack, p.pack_id)
            pack_name = pack.name if pack else None
        result.append(
            {
                "id": str(p.id),
                "pack_id": str(p.pack_id) if p.pack_id else None,
                "pack_name": pack_name,
                "credits_granted": p.credits_granted,
                "amount_paid_cents": p.amount_paid_cents,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
            }
        )

    return result


@router.get("/earnings")
def get_creator_earnings(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Creator earnings breakdown — credits earned across all owned agents."""
    earnings_rows = session.exec(
        select(CreatorEarnings)
        .where(CreatorEarnings.owner_id == user.id)
        .order_by(CreatorEarnings.created_at.desc())  # type: ignore[union-attr]
        .limit(200)
    ).all()

    total_net = 0
    result = []
    for e in earnings_rows:
        agent = session.get(AgentProfile, e.agent_profile_id)
        result.append(
            {
                "id": str(e.id),
                "agent_profile_id": str(e.agent_profile_id),
                "agent_name": agent.name if agent else None,
                "gross_credits": e.gross_credits,
                "platform_fee_credits": e.platform_fee_credits,
                "net_credits": e.net_credits,
                "created_at": e.created_at.isoformat(),
            }
        )
        total_net += e.net_credits

    return {"earnings": result, "total_net_credits": total_net}
