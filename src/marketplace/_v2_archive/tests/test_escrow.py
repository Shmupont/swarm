"""Escrow ledger correctness tests."""
import uuid

import pytest
from sqlmodel import Session

from marketplace.escrow import fund_escrow, refund_escrow, release_escrow
from marketplace.models import BuyerBalance, EscrowLedger


def _setup_buyer(session: Session, balance: int = 10000) -> uuid.UUID:
    agent_id = uuid.uuid4()
    bal = BuyerBalance(agent_id=agent_id, balance_cents=balance)
    session.add(bal)
    session.commit()
    return agent_id


def test_fund_escrow(session):
    buyer_id = _setup_buyer(session, 10000)

    escrow = fund_escrow(session, buyer_id, 5000)
    session.commit()

    assert escrow.funded_cents == 5000
    assert escrow.status == "funded"

    bal = session.get(BuyerBalance, escrow.id)  # wrong lookup
    # check buyer balance directly
    from sqlmodel import select
    bal = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == buyer_id)
    ).first()
    assert bal.balance_cents == 5000  # 10000 - 5000


def test_fund_escrow_insufficient(session):
    buyer_id = _setup_buyer(session, 1000)

    with pytest.raises(ValueError, match="Insufficient funds"):
        fund_escrow(session, buyer_id, 5000)


def test_release_escrow(session):
    buyer_id = _setup_buyer(session, 10000)
    seller_id = uuid.uuid4()

    escrow = fund_escrow(session, buyer_id, 5000)
    session.commit()

    release_escrow(session, escrow, seller_id)
    session.commit()

    assert escrow.status == "released"
    assert escrow.released_cents == 5000

    from sqlmodel import select
    seller_bal = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == seller_id)
    ).first()
    assert seller_bal.balance_cents == 5000


def test_refund_full(session):
    buyer_id = _setup_buyer(session, 10000)

    escrow = fund_escrow(session, buyer_id, 5000)
    session.commit()

    refund_escrow(session, escrow, buyer_id)
    session.commit()

    assert escrow.status == "refunded"
    assert escrow.refunded_cents == 5000

    from sqlmodel import select
    bal = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == buyer_id)
    ).first()
    assert bal.balance_cents == 10000  # fully refunded


def test_refund_partial(session):
    buyer_id = _setup_buyer(session, 10000)

    escrow = fund_escrow(session, buyer_id, 5000)
    session.commit()

    refund_escrow(session, escrow, buyer_id, amount_cents=2000)
    session.commit()

    assert escrow.status == "partial"
    assert escrow.refunded_cents == 2000

    from sqlmodel import select
    bal = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == buyer_id)
    ).first()
    assert bal.balance_cents == 7000  # 5000 + 2000


def test_double_release_fails(session):
    buyer_id = _setup_buyer(session, 10000)
    seller_id = uuid.uuid4()

    escrow = fund_escrow(session, buyer_id, 5000)
    session.commit()

    release_escrow(session, escrow, seller_id)
    session.commit()

    with pytest.raises(ValueError, match="Cannot release"):
        release_escrow(session, escrow, seller_id)
