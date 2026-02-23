import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..auth import get_current_user
from ..config import get_settings
from ..database import get_session
from ..models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/connect", tags=["connect"])


def _get_stripe():
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(503, "Stripe not configured")
    stripe.api_key = settings.stripe_secret_key
    return stripe


# ── Schemas ───────────────────────────────────────────────────────────


class ConnectStatusResponse(BaseModel):
    connected: bool
    verified: bool
    stripe_account_id: str | None


class OnboardResponse(BaseModel):
    url: str


class CashoutRequest(BaseModel):
    amount_credits: int


class CashoutResponse(BaseModel):
    success: bool
    amount_usd: float
    transfer_id: str


# ── Endpoints ─────────────────────────────────────────────────────────


@router.get("/status", response_model=ConnectStatusResponse)
def get_connect_status(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Return whether the user has a connected and verified Stripe Express account."""
    if not user.stripe_connect_account_id:
        return ConnectStatusResponse(connected=False, verified=False, stripe_account_id=None)

    _get_stripe()
    try:
        account = stripe.Account.retrieve(user.stripe_connect_account_id)
        verified = account.get("charges_enabled", False) and account.get("payouts_enabled", False)
        return ConnectStatusResponse(
            connected=True,
            verified=verified,
            stripe_account_id=user.stripe_connect_account_id,
        )
    except stripe.error.InvalidRequestError:
        return ConnectStatusResponse(connected=False, verified=False, stripe_account_id=None)


@router.post("/onboard", response_model=OnboardResponse)
def create_connect_onboard(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Create (or retrieve) a Stripe Connect Express account and return an onboarding URL."""
    _get_stripe()
    settings = get_settings()

    # Create account if not exists
    if not user.stripe_connect_account_id:
        account = stripe.Account.create(
            type="express",
            email=user.email,
            metadata={"user_id": str(user.id)},
        )
        user.stripe_connect_account_id = account.id
        session.add(user)
        session.commit()
        session.refresh(user)

    # Create onboarding link
    account_link = stripe.AccountLink.create(
        account=user.stripe_connect_account_id,
        refresh_url=f"{settings.frontend_origin}/dashboard/earnings",
        return_url=f"{settings.frontend_origin}/dashboard/earnings?connected=true",
        type="account_onboarding",
    )

    return OnboardResponse(url=account_link.url)


@router.post("/cashout", response_model=CashoutResponse)
def request_cashout(
    body: CashoutRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Transfer credits to cash and send to user's connected Stripe account."""
    if body.amount_credits < 1000:
        raise HTTPException(400, "Minimum cashout is 1,000 credits ($10.00)")

    if not user.stripe_connect_account_id:
        raise HTTPException(400, "No connected Stripe account. Please complete onboarding first.")

    if user.credit_balance < body.amount_credits:
        raise HTTPException(400, "Insufficient credit balance")

    _get_stripe()

    # Verify account is fully onboarded
    try:
        account = stripe.Account.retrieve(user.stripe_connect_account_id)
    except stripe.error.InvalidRequestError as e:
        raise HTTPException(400, f"Stripe account error: {e}")

    if not account.get("charges_enabled") or not account.get("payouts_enabled"):
        raise HTTPException(400, "Stripe account is not fully verified yet. Please complete onboarding.")

    # 1 credit = $0.01 → amount_credits credits = amount_credits cents
    amount_usd_cents = body.amount_credits  # 1 credit = $0.01

    try:
        transfer = stripe.Transfer.create(
            amount=amount_usd_cents,
            currency="usd",
            destination=user.stripe_connect_account_id,
            metadata={
                "user_id": str(user.id),
                "credits": str(body.amount_credits),
            },
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe transfer failed for user {user.id}: {e}")
        raise HTTPException(500, f"Transfer failed: {e.user_message or str(e)}")

    # Deduct credits
    user.credit_balance -= body.amount_credits
    session.add(user)
    session.commit()

    logger.info(
        f"Cashout: user {user.id} cashed out {body.amount_credits} credits "
        f"(${amount_usd_cents / 100:.2f}) via transfer {transfer.id}"
    )

    return CashoutResponse(
        success=True,
        amount_usd=amount_usd_cents / 100,
        transfer_id=transfer.id,
    )
