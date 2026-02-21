import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, func, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AGENT_CATEGORIES, AgentProfile, Conversation, Message, Task, User
from ..schemas import (
    AgentBriefResponse,
    AgentCreateRequest,
    AgentResponse,
    AgentUpdateRequest,
    AgentBrainConfigRequest,
    AgentApiKeyRequest,
    AgentPricingRequest,
    DashboardStatsResponse,
    WebhookConfigRequest,
    WebhookConfigResponse,
)
from ..encryption import encrypt_api_key, mask_api_key
from ..llm import validate_api_key
from ..slug import ensure_unique_slug, generate_slug
from ..webhook import generate_webhook_secret, ping_webhook

router = APIRouter(tags=["agents"])


def _enrich(profile: AgentProfile, session: Session) -> AgentResponse:
    resp = AgentResponse.model_validate(profile)
    owner = session.get(User, profile.owner_id)
    resp.owner_display_name = (owner.display_name or owner.email) if owner else None
    resp.is_chat_ready = bool(profile.system_prompt and profile.has_api_key)
    resp.is_free = profile.is_free
    resp.price_per_conversation_cents = profile.price_per_conversation_cents
    resp.price_per_message_cents = profile.price_per_message_cents
    return resp


# ── Create / Dock ────────────────────────────────────────────────────


@router.post("/agents", response_model=AgentResponse, status_code=201)
def create_agent_profile(
    data: AgentCreateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if data.category not in AGENT_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Must be one of: {AGENT_CATEGORIES}")

    base_slug = generate_slug(data.name)
    slug = ensure_unique_slug(session, base_slug)

    now = datetime.now(UTC).replace(tzinfo=None)
    profile = AgentProfile(
        owner_id=user.id,
        name=data.name,
        slug=slug,
        tagline=data.tagline,
        description=data.description,
        category=data.category,
        avatar_url=data.avatar_url,
        tags=data.tags,
        capabilities=data.capabilities,
        pricing_model=data.pricing_model,
        pricing_details=data.pricing_details,
        demo_url=data.demo_url,
        source_url=data.source_url,
        api_endpoint=data.api_endpoint,
        portfolio=data.portfolio,
        is_docked=True,
        dock_date=now,
        status="active",
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return _enrich(profile, session)


# ── Browse (public) ──────────────────────────────────────────────────


@router.get("/agents", response_model=list[AgentResponse])
def browse_agents(
    category: str | None = None,
    search: str | None = None,
    sort: str = Query(default="newest", pattern="^(newest|popular|rating)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(get_session),
):
    query = select(AgentProfile).where(
        AgentProfile.is_docked == True,  # noqa: E712
        AgentProfile.status != "undocked",
    )

    if category:
        query = query.where(AgentProfile.category == category)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            col(AgentProfile.name).ilike(pattern)
            | col(AgentProfile.tagline).ilike(pattern)
            | col(AgentProfile.description).ilike(pattern)
        )

    if sort == "rating":
        query = query.order_by(col(AgentProfile.avg_rating).desc().nulls_last())
    elif sort == "popular":
        query = query.order_by(col(AgentProfile.total_hires).desc())
    else:
        query = query.order_by(col(AgentProfile.created_at).desc())

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    profiles = session.exec(query).all()
    return [_enrich(p, session) for p in profiles]


# ── Featured (public) ────────────────────────────────────────────────


@router.get("/agents/featured", response_model=list[AgentResponse])
def get_featured_agents(session: Session = Depends(get_session)):
    profiles = session.exec(
        select(AgentProfile)
        .where(
            AgentProfile.is_featured == True,  # noqa: E712
            AgentProfile.is_docked == True,  # noqa: E712
        )
        .order_by(col(AgentProfile.avg_rating).desc().nulls_last())
        .limit(6)
    ).all()
    return [_enrich(p, session) for p in profiles]


# ── Categories (public) ──────────────────────────────────────────────


@router.get("/agents/categories")
def get_categories(session: Session = Depends(get_session)):
    counts = session.exec(
        select(AgentProfile.category, func.count(AgentProfile.id))
        .where(AgentProfile.is_docked == True)  # noqa: E712
        .group_by(AgentProfile.category)
    ).all()
    count_map = {cat: cnt for cat, cnt in counts}
    return [
        {"name": cat, "count": count_map.get(cat, 0)}
        for cat in AGENT_CATEGORIES
    ]


# ── My Agents (JWT) ─────────────────────────────────────────────────


@router.get("/agents/mine", response_model=list[AgentResponse])
def list_my_agents(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profiles = session.exec(
        select(AgentProfile)
        .where(AgentProfile.owner_id == user.id)
        .order_by(col(AgentProfile.created_at).desc())
    ).all()
    return [_enrich(p, session) for p in profiles]


# ── Get by slug (public) ────────────────────────────────────────────


@router.get("/agents/{slug}", response_model=AgentResponse)
def get_agent_by_slug(slug: str, session: Session = Depends(get_session)):
    profile = session.exec(
        select(AgentProfile).where(AgentProfile.slug == slug)
    ).first()
    if not profile:
        raise HTTPException(404, "Agent not found")
    return _enrich(profile, session)


# ── Update (JWT, owner) ─────────────────────────────────────────────


@router.patch("/agents/{id}", response_model=AgentResponse)
def update_agent_profile(
    id: uuid.UUID,
    data: AgentUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profile = session.get(AgentProfile, id)
    if not profile or profile.owner_id != user.id:
        raise HTTPException(404, "Agent not found")

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != profile.name:
        base_slug = generate_slug(update_data["name"])
        update_data["slug"] = ensure_unique_slug(session, base_slug, exclude_id=id)

    if "category" in update_data and update_data["category"] not in AGENT_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Must be one of: {AGENT_CATEGORIES}")

    if "status" in update_data and update_data["status"] not in ("active", "idle", "paused"):
        raise HTTPException(400, "Status must be one of: active, idle, paused")

    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.updated_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return _enrich(profile, session)


# ── Delete / Undock (JWT, owner) ─────────────────────────────────────


@router.delete("/agents/{id}", status_code=204)
def delete_agent_profile(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profile = session.get(AgentProfile, id)
    if not profile or profile.owner_id != user.id:
        raise HTTPException(404, "Agent not found")

    # Soft delete: undock the agent
    profile.is_docked = False
    profile.status = "undocked"
    profile.updated_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(profile)
    session.commit()


# ── Agent Brain Config (JWT, owner) ────────────────────────────────


@router.post("/agents/{id}/brain")
def configure_agent_brain(
    id: uuid.UUID,
    data: AgentBrainConfigRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(403, "Not your agent")

    agent.system_prompt = data.system_prompt
    agent.llm_model = data.llm_model
    agent.temperature = data.temperature
    agent.max_tokens = data.max_tokens
    agent.updated_at = datetime.now(UTC).replace(tzinfo=None)

    session.add(agent)
    session.commit()
    session.refresh(agent)
    return {"status": "ok", "model": agent.llm_model}


@router.post("/agents/{id}/api-key")
def set_agent_api_key(
    id: uuid.UUID,
    data: AgentApiKeyRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(403, "Not your agent")

    if not data.api_key.startswith("sk-ant-"):
        raise HTTPException(400, "Invalid Anthropic API key format. Must start with sk-ant-")

    is_valid = validate_api_key(data.api_key)
    if not is_valid:
        raise HTTPException(400, "API key is invalid. Please check and try again.")

    agent.encrypted_api_key = encrypt_api_key(data.api_key)
    agent.api_key_preview = mask_api_key(data.api_key)
    agent.has_api_key = True
    agent.updated_at = datetime.now(UTC).replace(tzinfo=None)

    session.add(agent)
    session.commit()
    return {"status": "ok", "preview": agent.api_key_preview}


@router.delete("/agents/{id}/api-key")
def remove_agent_api_key(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(403, "Not your agent")

    agent.encrypted_api_key = None
    agent.api_key_preview = None
    agent.has_api_key = False
    agent.updated_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(agent)
    session.commit()
    return {"status": "ok"}


@router.post("/agents/{id}/pricing")
def set_agent_pricing(
    id: uuid.UUID,
    data: AgentPricingRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(403, "Not your agent")

    agent.price_per_conversation_cents = data.price_per_conversation_cents
    agent.price_per_message_cents = data.price_per_message_cents
    agent.is_free = data.is_free
    agent.updated_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(agent)
    session.commit()
    return {"status": "ok"}


@router.get("/agents/{id}/brain-status")
def get_brain_status(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(403, "Not your agent")

    return {
        "has_system_prompt": bool(agent.system_prompt),
        "system_prompt": agent.system_prompt or "",
        "has_api_key": agent.has_api_key,
        "api_key_preview": agent.api_key_preview,
        "model": agent.llm_model,
        "temperature": agent.temperature,
        "max_tokens": agent.max_tokens,
        "is_chat_ready": bool(agent.system_prompt and agent.has_api_key),
        "pricing": {
            "is_free": agent.is_free,
            "per_conversation_cents": agent.price_per_conversation_cents,
            "per_message_cents": agent.price_per_message_cents,
        },
    }


# ── Webhook Config (JWT, owner) ────────────────────────────────────


@router.post("/agents/{id}/webhook", response_model=WebhookConfigResponse)
async def configure_webhook(
    id: uuid.UUID,
    data: WebhookConfigRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profile = session.get(AgentProfile, id)
    if not profile or profile.owner_id != user.id:
        raise HTTPException(404, "Agent not found")

    secret, prefix, secret_hash = generate_webhook_secret()

    profile.webhook_url = data.webhook_url
    profile.webhook_secret_hash = secret_hash
    profile.webhook_secret_prefix = prefix
    profile.max_concurrent_tasks = data.max_concurrent_tasks
    profile.auto_accept_tasks = data.auto_accept_tasks
    profile.accepted_task_types = data.accepted_task_types
    profile.webhook_status = "connected"
    profile.updated_at = datetime.now(UTC).replace(tzinfo=None)

    # Ping the webhook to verify
    reachable = await ping_webhook(data.webhook_url, secret_hash)
    if not reachable:
        profile.webhook_status = "failed"

    session.add(profile)
    session.commit()
    session.refresh(profile)

    return WebhookConfigResponse(
        webhook_url=profile.webhook_url,
        webhook_secret=secret,  # only returned on initial config
        webhook_secret_prefix=profile.webhook_secret_prefix,
        webhook_status=profile.webhook_status,
        webhook_last_ping=profile.webhook_last_ping,
        max_concurrent_tasks=profile.max_concurrent_tasks,
        auto_accept_tasks=profile.auto_accept_tasks,
        accepted_task_types=profile.accepted_task_types or [],
    )


@router.post("/agents/{id}/webhook/test")
async def test_webhook(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profile = session.get(AgentProfile, id)
    if not profile or profile.owner_id != user.id:
        raise HTTPException(404, "Agent not found")
    if not profile.webhook_url or not profile.webhook_secret_hash:
        raise HTTPException(400, "Webhook not configured")

    reachable = await ping_webhook(profile.webhook_url, profile.webhook_secret_hash)
    now = datetime.now(UTC).replace(tzinfo=None)

    profile.webhook_last_ping = now
    profile.webhook_status = "connected" if reachable else "failed"
    profile.updated_at = now
    session.add(profile)
    session.commit()

    return {"success": reachable, "webhook_status": profile.webhook_status}


@router.post("/agents/{id}/webhook/regenerate", response_model=WebhookConfigResponse)
def regenerate_webhook_secret(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profile = session.get(AgentProfile, id)
    if not profile or profile.owner_id != user.id:
        raise HTTPException(404, "Agent not found")
    if not profile.webhook_url:
        raise HTTPException(400, "Webhook not configured")

    secret, prefix, secret_hash = generate_webhook_secret()
    profile.webhook_secret_hash = secret_hash
    profile.webhook_secret_prefix = prefix
    profile.updated_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(profile)
    session.commit()
    session.refresh(profile)

    return WebhookConfigResponse(
        webhook_url=profile.webhook_url,
        webhook_secret=secret,
        webhook_secret_prefix=profile.webhook_secret_prefix,
        webhook_status=profile.webhook_status,
        webhook_last_ping=profile.webhook_last_ping,
        max_concurrent_tasks=profile.max_concurrent_tasks,
        auto_accept_tasks=profile.auto_accept_tasks,
        accepted_task_types=profile.accepted_task_types or [],
    )


@router.delete("/agents/{id}/webhook", status_code=204)
def remove_webhook(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profile = session.get(AgentProfile, id)
    if not profile or profile.owner_id != user.id:
        raise HTTPException(404, "Agent not found")

    profile.webhook_url = None
    profile.webhook_secret_hash = None
    profile.webhook_secret_prefix = None
    profile.webhook_status = "unconfigured"
    profile.webhook_last_ping = None
    profile.updated_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(profile)
    session.commit()


# ── Dashboard Stats (JWT) ───────────────────────────────────────────


@router.get("/users/dashboard-stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Get all agents owned by this user
    my_agents = session.exec(
        select(AgentProfile).where(AgentProfile.owner_id == user.id)
    ).all()

    total_earned = sum(a.total_earned_cents for a in my_agents)

    # Count unread messages across all conversations where user is a participant
    unread = session.exec(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            (Conversation.initiator_id == user.id) | (Conversation.owner_id == user.id),
            Message.sender_id != user.id,
            Message.is_read == False,  # noqa: E712
        )
    ).one()

    agent_briefs = [
        AgentBriefResponse(
            id=a.id,
            name=a.name,
            slug=a.slug,
            status=a.status,
            tasks_completed=a.tasks_completed,
            total_earned_cents=a.total_earned_cents,
            total_hires=a.total_hires,
            avg_rating=a.avg_rating,
        )
        for a in my_agents
    ]

    # Count active tasks across all user's agents
    agent_ids = [a.id for a in my_agents]
    active_tasks = 0
    if agent_ids:
        active_tasks = session.exec(
            select(func.count(Task.id)).where(
                Task.agent_profile_id.in_(agent_ids),  # type: ignore[union-attr]
                Task.status.in_(["assigned", "dispatched", "in_progress"]),  # type: ignore[union-attr]
            )
        ).one()

    return DashboardStatsResponse(
        total_agents=len(my_agents),
        active_tasks=active_tasks,
        total_earned_cents=total_earned,
        unread_messages=unread,
        agents=agent_briefs,
        recent_activity=[],
    )
