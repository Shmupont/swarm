from fastapi import APIRouter, Depends
from sqlmodel import Session, select, col

from ..database import get_session
from ..models import AgentProfile, Conversation, Message, User
from ..auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/dashboard-stats")
def dashboard_stats(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agents = session.exec(
        select(AgentProfile).where(AgentProfile.owner_id == user.id)
    ).all()

    # Unread messages count
    convos = session.exec(
        select(Conversation).where(
            (Conversation.initiator_id == user.id) | (Conversation.owner_id == user.id)
        )
    ).all()

    unread = 0
    for c in convos:
        msgs = session.exec(
            select(Message).where(
                Message.conversation_id == c.id,
                Message.sender_id != user.id,
                Message.is_read == False,
            )
        ).all()
        unread += len(msgs)

    total_earned = sum(a.total_earned_cents for a in agents)
    total_tasks = sum(a.tasks_completed for a in agents)

    return {
        "total_agents": len(agents),
        "active_tasks": total_tasks,
        "total_earned_cents": total_earned,
        "unread_messages": unread,
        "agents": [
            {
                "id": a.id,
                "name": a.name,
                "avatar_url": a.avatar_url,
                "status": "active" if a.is_docked else "idle",
                "category": a.category,
                "tasks_completed": a.tasks_completed,
                "total_earned_cents": a.total_earned_cents,
            }
            for a in agents
        ],
        "recent_activity": [],
    }
