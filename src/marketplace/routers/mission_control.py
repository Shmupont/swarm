"""Mission Control — enriched stats, agent army, and activity feed for the creator dashboard."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AgentLicense, AgentPost, AgentProfile, CreatorEarnings, Task, User

router = APIRouter(prefix="/mission-control", tags=["Mission Control"])


def _user_agent_ids(user: User, session: Session) -> list[uuid.UUID]:
    rows = session.exec(
        select(AgentProfile.id).where(AgentProfile.owner_id == user.id)
    ).all()
    return list(rows)


@router.get("/stats")
def get_stats(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """KPI summary for the mission control header bar."""
    agent_ids = _user_agent_ids(user, session)

    # Active agents
    active_agents = session.exec(
        select(func.count(AgentProfile.id)).where(
            AgentProfile.owner_id == user.id,
            AgentProfile.status == "active",
        )
    ).one() or 0

    # Tasks assigned to user's agents in the last 24 h
    cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=24)
    tasks_today = 0
    if agent_ids:
        tasks_today = session.exec(
            select(func.count(Task.id)).where(
                Task.agent_profile_id.in_(agent_ids),
                Task.created_at >= cutoff,
            )
        ).one() or 0

    # Credits earned (sum net_credits across all CreatorEarnings for this user)
    credits_earned_result = session.exec(
        select(func.sum(CreatorEarnings.net_credits)).where(
            CreatorEarnings.owner_id == user.id,
        )
    ).one()
    credits_earned = credits_earned_result or 0

    # Hive posts across all user's agents
    hive_posts = 0
    if agent_ids:
        hive_posts = session.exec(
            select(func.count(AgentPost.id)).where(
                AgentPost.agent_profile_id.in_(agent_ids),
                AgentPost.is_published == True,  # noqa: E712
            )
        ).one() or 0

    return {
        "active_agents": int(active_agents),
        "tasks_today": int(tasks_today),
        "credits_earned": int(credits_earned),
        "hive_posts": int(hive_posts),
    }


@router.get("/agents")
def get_agents(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """User's agents enriched with per-agent stats."""
    agents = session.exec(
        select(AgentProfile).where(AgentProfile.owner_id == user.id)
    ).all()

    result = []
    for agent in agents:
        tasks_total = session.exec(
            select(func.count(Task.id)).where(Task.agent_profile_id == agent.id)
        ).one() or 0

        credits_result = session.exec(
            select(func.sum(CreatorEarnings.net_credits)).where(
                CreatorEarnings.agent_profile_id == agent.id
            )
        ).one()
        credits_earned = credits_result or 0

        posts_count = session.exec(
            select(func.count(AgentPost.id)).where(
                AgentPost.agent_profile_id == agent.id,
                AgentPost.is_published == True,  # noqa: E712
            )
        ).one() or 0

        last_task_at = session.exec(
            select(Task.created_at)
            .where(Task.agent_profile_id == agent.id)
            .order_by(Task.created_at.desc())  # type: ignore[union-attr]
            .limit(1)
        ).first()

        result.append({
            "id": str(agent.id),
            "name": agent.name,
            "slug": agent.slug,
            "category": agent.category,
            "status": agent.status,
            "avatar_url": agent.avatar_url,
            "tasks_total": int(tasks_total),
            "credits_earned": int(credits_earned),
            "hive_posts_count": int(posts_count),
            "last_seen_at": agent.last_seen_at.isoformat() if agent.last_seen_at else None,
            "last_task_at": last_task_at.isoformat() if last_task_at else None,
        })

    return result


@router.get("/feed")
def get_feed(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Last 30 activity events across all user's agents, newest first."""
    agent_ids = _user_agent_ids(user, session)
    events: list[dict] = []

    if not agent_ids:
        return events

    # Tasks (recent 15)
    tasks = session.exec(
        select(Task)
        .where(Task.agent_profile_id.in_(agent_ids))
        .order_by(Task.created_at.desc())  # type: ignore[union-attr]
        .limit(15)
    ).all()

    for task in tasks:
        agent = session.get(AgentProfile, task.agent_profile_id)
        agent_name = agent.name if agent else "Unknown"
        if task.status == "completed":
            events.append({
                "type": "task_completed",
                "agent_name": agent_name,
                "agent_id": str(task.agent_profile_id),
                "description": f"Completed: {task.title}",
                "timestamp": (task.completed_at or task.updated_at).isoformat(),
            })
        else:
            events.append({
                "type": "task_started",
                "agent_name": agent_name,
                "agent_id": str(task.agent_profile_id),
                "description": f"New task: {task.title}",
                "timestamp": task.created_at.isoformat(),
            })

    # Hive posts (recent 10)
    posts = session.exec(
        select(AgentPost)
        .where(AgentPost.agent_profile_id.in_(agent_ids))
        .order_by(AgentPost.created_at.desc())  # type: ignore[union-attr]
        .limit(10)
    ).all()

    for post in posts:
        agent = session.get(AgentProfile, post.agent_profile_id)
        agent_name = agent.name if agent else "Unknown"
        snippet = post.content[:80] + ("..." if len(post.content) > 80 else "")
        events.append({
            "type": "hive_post",
            "agent_name": agent_name,
            "agent_id": str(post.agent_profile_id),
            "description": snippet,
            "timestamp": post.created_at.isoformat(),
        })

    # License purchases (recent 10)
    licenses = session.exec(
        select(AgentLicense)
        .where(AgentLicense.agent_profile_id.in_(agent_ids))
        .order_by(AgentLicense.created_at.desc())  # type: ignore[union-attr]
        .limit(10)
    ).all()

    for lic in licenses:
        agent = session.get(AgentProfile, lic.agent_profile_id)
        buyer = session.get(User, lic.buyer_id)
        agent_name = agent.name if agent else "Unknown"
        buyer_name = (buyer.display_name or buyer.email[:20]) if buyer else "Unknown"
        events.append({
            "type": "license_purchased",
            "agent_name": agent_name,
            "agent_id": str(lic.agent_profile_id),
            "description": f"New access: {buyer_name} licensed {agent_name}",
            "timestamp": lic.created_at.isoformat(),
        })

    # Sort newest first and cap at 30
    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return events[:30]
