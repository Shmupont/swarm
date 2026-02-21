"""Public marketplace: browse listings + hire flow."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..escrow import fund_escrow_user
from ..models import (
    Agent,
    Contract,
    Listing,
    TaskSpec,
    User,
)
from ..receipts import create_receipt
from ..schemas import (
    ContractResponse,
    HireRequest,
    ListingResponse,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


@router.get("/listings", response_model=list[ListingResponse])
def browse_listings(
    category: str | None = None,
    session: Session = Depends(get_session),
):
    query = select(Listing).where(Listing.is_active == True)  # noqa: E712
    if category:
        query = query.where(Listing.category == category)

    listings = session.exec(query).all()
    results = []
    for ls in listings:
        agent = session.get(Agent, ls.agent_id)
        resp = ListingResponse.model_validate(ls)
        resp.agent_name = agent.name if agent else None
        resp.agent_reputation = agent.reputation_score if agent else None
        results.append(resp)
    return results


@router.get("/listings/{listing_id}", response_model=ListingResponse)
def get_listing(
    listing_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    listing = session.get(Listing, listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")

    agent = session.get(Agent, listing.agent_id)
    resp = ListingResponse.model_validate(listing)
    resp.agent_name = agent.name if agent else None
    resp.agent_reputation = agent.reputation_score if agent else None
    return resp


@router.post(
    "/listings/{listing_id}/hire",
    response_model=ContractResponse,
    status_code=201,
)
def hire_agent(
    listing_id: uuid.UUID,
    data: HireRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Hire an agent from a listing: create task + escrow + contract."""
    listing = session.get(Listing, listing_id)
    if not listing or not listing.is_active:
        raise HTTPException(404, "Listing not found or inactive")

    agent = session.get(Agent, listing.agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    # Fund escrow from user wallet
    try:
        escrow = fund_escrow_user(session, user.id, data.budget_cents)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    # Create the task spec
    task = TaskSpec(
        created_by_agent_id=agent.id,
        created_by_user_id=user.id,
        title=data.title,
        description=data.description,
        acceptance_json=data.acceptance_json,
        budget_cents=data.budget_cents,
        deadline=data.deadline,
        status="contracted",
    )
    session.add(task)
    session.flush()

    # Create contract directly (no bidding for hire flow)
    contract = Contract(
        task_id=task.id,
        buyer_agent_id=agent.id,
        seller_agent_id=agent.id,
        escrow_id=escrow.id,
        price_cents=data.budget_cents,
        hiring_user_id=user.id,
    )
    session.add(contract)
    session.flush()

    escrow.contract_id = contract.id
    session.add(escrow)

    create_receipt(
        session, "marketplace.hired",
        {
            "listing_id": str(listing_id),
            "contract_id": str(contract.id),
            "user_id": str(user.id),
            "agent_id": str(agent.id),
            "budget_cents": data.budget_cents,
        },
    )
    session.commit()
    session.refresh(contract)

    return ContractResponse.model_validate(contract)
