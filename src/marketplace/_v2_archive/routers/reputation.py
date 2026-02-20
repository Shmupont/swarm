import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from ..database import get_session
from ..models import Agent
from ..schemas import ReputationResponse

router = APIRouter(tags=["reputation"])


@router.get("/agents/{agent_id}/reputation", response_model=ReputationResponse)
def get_reputation(
    agent_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return ReputationResponse(
        agent_id=agent.id,
        name=agent.name,
        reputation_score=agent.reputation_score,
        total_completed=agent.total_completed,
        total_failed=agent.total_failed,
        tier=agent.tier,
    )
