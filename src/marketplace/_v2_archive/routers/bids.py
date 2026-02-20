import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_agent
from ..database import get_session
from ..escrow import fund_escrow
from ..idempotency import check_idempotency, store_idempotency
from ..models import Agent, Bid, Contract, EscrowLedger, TaskSpec
from ..rate_limit import check_rate_limit
from ..receipts import create_receipt
from ..schemas import BidCreate, BidResponse, ContractResponse

router = APIRouter(tags=["bids"])


@router.post("/tasks/{task_id}/bids", response_model=BidResponse, status_code=201)
def create_bid(
    task_id: uuid.UUID,
    data: BidCreate,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    task = session.get(TaskSpec, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task.status != "open":
        raise HTTPException(400, "Task is not open for bidding")
    if task.created_by_agent_id == agent.id:
        raise HTTPException(400, "Cannot bid on your own task")
    if data.price_cents > task.budget_cents:
        raise HTTPException(400, "Bid exceeds task budget")

    bid = Bid(
        task_id=task_id,
        bidder_agent_id=agent.id,
        price_cents=data.price_cents,
        eta_seconds=data.eta_seconds,
        notes=data.notes,
    )
    session.add(bid)

    create_receipt(
        session, "bid.created",
        {"bid_id": str(bid.id), "task_id": str(task_id), "price_cents": data.price_cents},
        agent_id=agent.id,
    )
    session.commit()
    session.refresh(bid)

    return BidResponse.model_validate(bid)


@router.post("/bids/{bid_id}/withdraw", response_model=BidResponse)
def withdraw_bid(
    bid_id: uuid.UUID,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    bid = session.get(Bid, bid_id)
    if not bid:
        raise HTTPException(404, "Bid not found")
    if bid.bidder_agent_id != agent.id:
        raise HTTPException(403, "Not your bid")
    if bid.status != "active":
        raise HTTPException(400, f"Cannot withdraw bid in '{bid.status}' status")

    bid.status = "withdrawn"
    session.add(bid)

    create_receipt(
        session, "bid.withdrawn",
        {"bid_id": str(bid_id)},
        agent_id=agent.id,
    )
    session.commit()
    session.refresh(bid)

    return BidResponse.model_validate(bid)


@router.post("/bids/{bid_id}/accept", response_model=ContractResponse)
def accept_bid(
    bid_id: uuid.UUID,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Accept a bid → fund escrow → create contract → reject other bids."""
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    cached = check_idempotency(idempotency_key, agent.id, session)
    if cached is not None:
        return cached

    bid = session.get(Bid, bid_id)
    if not bid:
        raise HTTPException(404, "Bid not found")

    task = session.get(TaskSpec, bid.task_id)
    if task.created_by_agent_id != agent.id:
        raise HTTPException(403, "Only the task creator can accept bids")
    if bid.status != "active":
        raise HTTPException(400, f"Bid is not active (status: {bid.status})")
    if task.status != "open":
        raise HTTPException(400, "Task is not open")

    # Fund escrow from buyer balance
    try:
        escrow = fund_escrow(session, agent.id, bid.price_cents)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    # Create contract
    contract = Contract(
        task_id=task.id,
        buyer_agent_id=agent.id,
        seller_agent_id=bid.bidder_agent_id,
        escrow_id=escrow.id,
        price_cents=bid.price_cents,
    )
    session.add(contract)
    session.flush()

    # Back-reference
    escrow.contract_id = contract.id

    # Update statuses
    bid.status = "accepted"
    task.status = "contracted"

    # Reject other active bids on this task
    other_bids = session.exec(
        select(Bid).where(
            Bid.task_id == task.id,
            Bid.status == "active",
            Bid.id != bid.id,
        )
    ).all()
    for ob in other_bids:
        ob.status = "rejected"
        session.add(ob)

    session.add_all([escrow, contract, bid, task])

    create_receipt(
        session, "bid.accepted",
        {
            "bid_id": str(bid.id),
            "contract_id": str(contract.id),
            "escrow_id": str(escrow.id),
            "price_cents": bid.price_cents,
        },
        contract_id=contract.id,
        agent_id=agent.id,
    )

    response_data = ContractResponse.model_validate(contract).model_dump(mode="json")

    if idempotency_key:
        store_idempotency(idempotency_key, agent.id, 200, response_data, session)

    session.commit()

    return response_data
