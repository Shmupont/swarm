from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import generate_api_key, get_current_agent, hash_api_key
from ..database import get_session
from ..models import Agent, BuyerBalance
from ..rate_limit import check_rate_limit
from ..receipts import create_receipt
from ..schemas import (
    AgentRegister,
    AgentRegisterResponse,
    BalanceResponse,
    TopUpRequest,
)

router = APIRouter(tags=["agents"])


@router.post("/agents/register", response_model=AgentRegisterResponse)
def register_agent(
    data: AgentRegister,
    session: Session = Depends(get_session),
):
    api_key, prefix = generate_api_key()
    key_hash = hash_api_key(api_key)

    agent = Agent(
        name=data.name,
        public_key=data.public_key,
        api_key_hash=key_hash,
        api_key_prefix=prefix,
    )
    session.add(agent)
    session.flush()

    balance = BuyerBalance(agent_id=agent.id)
    session.add(balance)

    create_receipt(
        session, "agent.registered",
        {"agent_id": str(agent.id), "name": agent.name},
        agent_id=agent.id,
    )
    session.commit()

    return AgentRegisterResponse(agent_id=agent.id, api_key=api_key)


@router.post("/agents/rotate_key", response_model=AgentRegisterResponse)
def rotate_key(
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    api_key, prefix = generate_api_key()
    key_hash = hash_api_key(api_key)

    agent.api_key_hash = key_hash
    agent.api_key_prefix = prefix
    session.add(agent)

    create_receipt(
        session, "agent.key_rotated",
        {"agent_id": str(agent.id)},
        agent_id=agent.id,
    )
    session.commit()

    return AgentRegisterResponse(
        agent_id=agent.id,
        api_key=api_key,
        message="New key issued. Previous key is now invalid.",
    )


@router.post("/agents/balance/topup", response_model=BalanceResponse)
def topup_balance(
    data: TopUpRequest,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    balance = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == agent.id)
    ).first()
    balance.balance_cents += data.amount_cents
    session.add(balance)

    create_receipt(
        session, "balance.topup",
        {"agent_id": str(agent.id), "amount_cents": data.amount_cents},
        agent_id=agent.id,
    )
    session.commit()
    session.refresh(balance)

    return BalanceResponse(
        agent_id=agent.id,
        balance_cents=balance.balance_cents,
        currency=balance.currency,
    )


@router.get("/agents/balance", response_model=BalanceResponse)
def get_balance(
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    balance = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == agent.id)
    ).first()
    return BalanceResponse(
        agent_id=agent.id,
        balance_cents=balance.balance_cents,
        currency=balance.currency,
    )
