import uuid

from sqlmodel import Session, select

from .models import BuyerBalance, EscrowLedger


def fund_escrow(
    session: Session,
    buyer_agent_id: uuid.UUID,
    amount_cents: int,
) -> EscrowLedger:
    """Deduct from buyer balance and create a funded escrow entry."""
    balance = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == buyer_agent_id)
    ).first()

    if not balance or balance.balance_cents < amount_cents:
        raise ValueError("Insufficient funds")

    balance.balance_cents -= amount_cents

    escrow = EscrowLedger(funded_cents=amount_cents, status="funded")
    session.add(escrow)
    session.add(balance)
    session.flush()  # materialise escrow.id
    return escrow


def fund_escrow_user(
    session: Session,
    user_id: uuid.UUID,
    amount_cents: int,
) -> EscrowLedger:
    """Deduct from user wallet and create a funded escrow entry."""
    balance = session.exec(
        select(BuyerBalance).where(BuyerBalance.user_id == user_id)
    ).first()

    if not balance or balance.balance_cents < amount_cents:
        raise ValueError("Insufficient funds")

    balance.balance_cents -= amount_cents

    escrow = EscrowLedger(funded_cents=amount_cents, status="funded")
    session.add(escrow)
    session.add(balance)
    session.flush()
    return escrow


def release_escrow(
    session: Session,
    escrow: EscrowLedger,
    seller_agent_id: uuid.UUID,
) -> None:
    """Release remaining escrow funds to the seller."""
    if escrow.status not in ("funded", "partial"):
        raise ValueError(f"Cannot release escrow in '{escrow.status}' status")

    amount = escrow.funded_cents - escrow.released_cents - escrow.refunded_cents
    if amount <= 0:
        raise ValueError("No funds to release")

    seller_balance = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == seller_agent_id)
    ).first()
    if not seller_balance:
        seller_balance = BuyerBalance(agent_id=seller_agent_id, balance_cents=0)
        session.add(seller_balance)

    seller_balance.balance_cents += amount
    escrow.released_cents += amount
    escrow.status = "released"

    session.add(escrow)
    session.add(seller_balance)


def refund_escrow(
    session: Session,
    escrow: EscrowLedger,
    buyer_agent_id: uuid.UUID,
    amount_cents: int | None = None,
) -> None:
    """Refund escrow (full or partial) back to the buyer."""
    if escrow.status not in ("funded", "partial"):
        raise ValueError(f"Cannot refund escrow in '{escrow.status}' status")

    available = escrow.funded_cents - escrow.released_cents - escrow.refunded_cents
    refund_amount = min(amount_cents or available, available)
    if refund_amount <= 0:
        raise ValueError("No funds to refund")

    buyer_balance = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == buyer_agent_id)
    ).first()
    buyer_balance.balance_cents += refund_amount
    escrow.refunded_cents += refund_amount

    remaining = escrow.funded_cents - escrow.released_cents - escrow.refunded_cents
    escrow.status = "refunded" if remaining == 0 else "partial"

    session.add(escrow)
    session.add(buyer_balance)
