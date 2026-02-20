import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func, col

from ..database import get_session
from ..models import AgentProfile, User, new_id, utcnow
from ..auth import get_current_user, get_optional_user

router = APIRouter(prefix="/agents", tags=["agents"])


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "agent"


def agent_to_dict(a: AgentProfile, owner: Optional[User] = None) -> dict:
    d = {
        "id": a.id,
        "owner_id": a.owner_id,
        "name": a.name,
        "slug": a.slug,
        "tagline": a.tagline,
        "description": a.description,
        "avatar_url": a.avatar_url,
        "category": a.category,
        "tags": a.tags or [],
        "capabilities": a.capabilities or [],
        "pricing_model": a.pricing_model,
        "pricing_details": a.pricing_details or {},
        "demo_url": a.demo_url,
        "source_url": a.source_url,
        "api_endpoint": a.api_endpoint,
        "portfolio": a.portfolio or [],
        "total_hires": a.total_hires,
        "avg_rating": a.avg_rating,
        "response_time_hours": a.response_time_hours,
        "tasks_completed": a.tasks_completed,
        "total_earned_cents": a.total_earned_cents,
        "is_docked": a.is_docked,
        "is_featured": a.is_featured,
        "dock_date": a.dock_date.isoformat() if a.dock_date else None,
        "status": a.status,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
        "webhook_url": a.webhook_url,
        "webhook_status": a.webhook_status or "unconfigured",
        "webhook_last_ping": a.webhook_last_ping.isoformat() if a.webhook_last_ping else None,
        "max_concurrent_tasks": a.max_concurrent_tasks or 5,
        "auto_accept_tasks": a.auto_accept_tasks or False,
        "accepted_task_types": a.accepted_task_types or [],
        "active_task_count": 0,
    }
    if owner:
        d["owner_display_name"] = owner.display_name
    return d


# ── Public routes ───────────────────────────────────────────────

@router.get("")
def browse_agents(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    query = select(AgentProfile).where(AgentProfile.is_docked == True)

    if category:
        query = query.where(AgentProfile.category == category)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            (col(AgentProfile.name).ilike(pattern))
            | (col(AgentProfile.tagline).ilike(pattern))
            | (col(AgentProfile.description).ilike(pattern))
        )

    if sort == "rating":
        query = query.order_by(col(AgentProfile.avg_rating).desc().nullslast())
    elif sort == "hires":
        query = query.order_by(col(AgentProfile.total_hires).desc())
    elif sort == "newest":
        query = query.order_by(col(AgentProfile.created_at).desc())
    else:
        query = query.order_by(col(AgentProfile.is_featured).desc(), col(AgentProfile.total_hires).desc())

    offset = (page - 1) * limit
    agents = session.exec(query.offset(offset).limit(limit)).all()

    results = []
    for a in agents:
        owner = session.get(User, a.owner_id)
        results.append(agent_to_dict(a, owner))
    return results


@router.get("/featured")
def featured_agents(session: Session = Depends(get_session)):
    agents = session.exec(
        select(AgentProfile)
        .where(AgentProfile.is_docked == True, AgentProfile.is_featured == True)
        .order_by(col(AgentProfile.total_hires).desc())
        .limit(6)
    ).all()

    # If fewer than 6 featured, fill with top agents
    if len(agents) < 6:
        existing_ids = {a.id for a in agents}
        more = session.exec(
            select(AgentProfile)
            .where(AgentProfile.is_docked == True, col(AgentProfile.id).notin_(existing_ids))
            .order_by(col(AgentProfile.total_hires).desc())
            .limit(6 - len(agents))
        ).all()
        agents.extend(more)

    results = []
    for a in agents:
        owner = session.get(User, a.owner_id)
        results.append(agent_to_dict(a, owner))
    return results


@router.get("/categories")
def get_categories(session: Session = Depends(get_session)):
    results = session.exec(
        select(AgentProfile.category, func.count(AgentProfile.id))
        .where(AgentProfile.is_docked == True)
        .group_by(AgentProfile.category)
    ).all()
    return [{"category": cat, "count": count} for cat, count in results]


@router.get("/mine")
def my_agents(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agents = session.exec(
        select(AgentProfile)
        .where(AgentProfile.owner_id == user.id)
        .order_by(col(AgentProfile.created_at).desc())
    ).all()
    return [agent_to_dict(a) for a in agents]


@router.get("/{slug}")
def get_agent(slug: str, session: Session = Depends(get_session)):
    agent = session.exec(select(AgentProfile).where(AgentProfile.slug == slug)).first()
    if not agent:
        # Try by ID
        agent = session.get(AgentProfile, slug)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    owner = session.get(User, agent.owner_id)
    return agent_to_dict(agent, owner)


# ── Authenticated routes ────────────────────────────────────────

class CreateAgentRequest(BaseModel):
    name: str
    tagline: str | None = None
    description: str = ""
    category: str = "other"
    avatar_url: str | None = None
    tags: list[str] = []
    capabilities: list[str] = []
    pricing_model: str | None = None
    demo_url: str | None = None
    source_url: str | None = None
    api_endpoint: str | None = None
    portfolio: list[dict] = []


class UpdateAgentRequest(BaseModel):
    name: str | None = None
    tagline: str | None = None
    description: str | None = None
    category: str | None = None
    avatar_url: str | None = None
    tags: list[str] | None = None
    capabilities: list[str] | None = None
    pricing_model: str | None = None
    demo_url: str | None = None
    source_url: str | None = None
    api_endpoint: str | None = None
    portfolio: list[dict] | None = None
    is_active: bool | None = None


@router.post("")
def create_agent(
    body: CreateAgentRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    base_slug = slugify(body.name)
    slug = base_slug
    counter = 1
    while session.exec(select(AgentProfile).where(AgentProfile.slug == slug)).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    agent = AgentProfile(
        owner_id=user.id,
        name=body.name,
        slug=slug,
        tagline=body.tagline,
        description=body.description,
        category=body.category,
        avatar_url=body.avatar_url,
        tags=body.tags,
        capabilities=body.capabilities,
        pricing_model=body.pricing_model,
        demo_url=body.demo_url,
        source_url=body.source_url,
        api_endpoint=body.api_endpoint,
        portfolio=body.portfolio,
    )
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent_to_dict(agent)


@router.patch("/{agent_id}")
def update_agent(
    agent_id: str,
    body: UpdateAgentRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your agent")

    update_data = body.model_dump(exclude_unset=True)

    if "is_active" in update_data:
        agent.is_docked = update_data.pop("is_active")

    if "name" in update_data and update_data["name"] != agent.name:
        base_slug = slugify(update_data["name"])
        slug = base_slug
        counter = 1
        while True:
            existing = session.exec(select(AgentProfile).where(AgentProfile.slug == slug)).first()
            if not existing or existing.id == agent_id:
                break
            slug = f"{base_slug}-{counter}"
            counter += 1
        agent.slug = slug

    for key, value in update_data.items():
        if hasattr(agent, key):
            setattr(agent, key, value)

    agent.updated_at = utcnow()
    session.add(agent)
    session.commit()
    session.refresh(agent)
    return agent_to_dict(agent)


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your agent")

    session.delete(agent)
    session.commit()
    return {"ok": True}
