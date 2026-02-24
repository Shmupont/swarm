import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, func, select

from ..auth import get_current_user
from ..database import get_session
from ..licenses import create_license, generate_license_key
from ..models import (
    AGENT_CATEGORIES,
    AgentLicense,
    AgentPricingPlan,
    AgentProfile,
    Conversation,
    Message,
    ProxyUsageLog,
    Task,
    TrialSession,
    User,
)
from ..schemas import (
    AgentBriefResponse,
    AgentConfigUpdateRequest,
    AgentConfigResponse,
    AgentCreateRequest,
    AgentResponse,
    AgentUpdateRequest,
    AgentBrainConfigRequest,
    AgentApiKeyRequest,
    AgentPricingRequest,
    DashboardStatsResponse,
    HireResponse,
    LicenseResponse,
    PricingPlanCreateRequest,
    PricingPlanResponse,
    PurchaseRequest,
    PurchaseResponse,
    TrialSendRequest,
    TrialResponse,
    TrialStatusResponse,
    UsageLogResponse,
    UsageStatsResponse,
    WebhookConfigRequest,
    WebhookConfigResponse,
)
from ..encryption import encrypt_api_key, mask_api_key
from ..llm import validate_api_key, has_platform_key
from ..slug import ensure_unique_slug, generate_slug
from ..webhook import generate_webhook_secret, ping_webhook

router = APIRouter(tags=["agents"])


def _enrich(profile: AgentProfile, session: Session) -> AgentResponse:
    resp = AgentResponse.model_validate(profile)
    owner = session.get(User, profile.owner_id)
    resp.owner_display_name = (owner.display_name or owner.email) if owner else None
    has_llm = profile.has_api_key or has_platform_key()
    resp.is_chat_ready = bool((profile.system_prompt or profile.openai_assistant_id) and has_llm)
    resp.is_free = profile.is_free
    resp.price_per_conversation_cents = profile.price_per_conversation_cents
    resp.price_per_message_cents = profile.price_per_message_cents
    resp.price_per_message_credits = profile.price_per_message_credits
    resp.welcome_message = profile.welcome_message
    resp.llm_provider = profile.llm_provider
    resp.listing_type = profile.listing_type
    resp.openclaw_repo_url = profile.openclaw_repo_url
    resp.openclaw_install_instructions = profile.openclaw_install_instructions
    resp.openclaw_version = profile.openclaw_version
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

    # Enforce 12-agent limit per user
    MAX_AGENTS_PER_USER = 12
    existing_count = session.exec(
        select(AgentProfile).where(AgentProfile.owner_id == user.id)
    ).all()
    if len(existing_count) >= MAX_AGENTS_PER_USER:
        raise HTTPException(400, f"Agent limit reached. Maximum {MAX_AGENTS_PER_USER} agents per user.")

    base_slug = generate_slug(data.name)
    slug = ensure_unique_slug(session, base_slug)

    now = datetime.now(UTC).replace(tzinfo=None)
    if data.listing_type not in ("chat", "openclaw"):
        raise HTTPException(400, "listing_type must be 'chat' or 'openclaw'")

    price_credits = 0
    if data.price_usd is not None:
        price_credits = round(data.price_usd * 100)

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
        listing_type=data.listing_type,
        openclaw_repo_url=data.openclaw_repo_url,
        openclaw_install_instructions=data.openclaw_install_instructions,
        openclaw_version=data.openclaw_version,
        price_per_message_credits=price_credits,
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

    if "listing_type" in update_data and update_data["listing_type"] not in ("chat", "openclaw"):
        raise HTTPException(400, "listing_type must be 'chat' or 'openclaw'")

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
        "is_chat_ready": bool(agent.system_prompt and (agent.has_api_key or has_platform_key())),
        "pricing": {
            "is_free": agent.is_free,
            "per_conversation_cents": agent.price_per_conversation_cents,
            "per_message_cents": agent.price_per_message_cents,
        },
    }


# ── Agent AI Config (owner-only) ────────────────────────────────


@router.get("/agents/{id}/config", response_model=AgentConfigResponse)
def get_agent_config(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(403, "Not your agent")
    return AgentConfigResponse(
        system_prompt=agent.system_prompt,
        welcome_message=agent.welcome_message,
        llm_model=agent.llm_model,
        llm_provider=agent.llm_provider,
        price_per_message_credits=agent.price_per_message_credits,
        has_api_key=agent.has_api_key,
        api_key_preview=agent.api_key_preview,
        openai_assistant_id=agent.openai_assistant_id,
    )


@router.patch("/agents/{id}/config", response_model=AgentConfigResponse)
def update_agent_config(
    id: uuid.UUID,
    data: AgentConfigUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(403, "Not your agent")

    if data.system_prompt is not None:
        agent.system_prompt = data.system_prompt
    if data.welcome_message is not None:
        agent.welcome_message = data.welcome_message
    if data.llm_model is not None:
        agent.llm_model = data.llm_model
    if data.llm_provider is not None:
        if data.llm_provider not in ("anthropic", "openai"):
            raise HTTPException(400, "llm_provider must be 'anthropic' or 'openai'")
        agent.llm_provider = data.llm_provider
    if data.price_per_message_credits is not None:
        if data.price_per_message_credits < 0:
            raise HTTPException(400, "price_per_message_credits must be >= 0")
        agent.price_per_message_credits = data.price_per_message_credits
    if data.api_key is not None and data.api_key.strip():
        agent.encrypted_api_key = encrypt_api_key(data.api_key.strip())
        agent.api_key_preview = mask_api_key(data.api_key.strip())
        agent.has_api_key = True
    if data.openai_assistant_id is not None:
        # Allow setting to "" to clear it
        agent.openai_assistant_id = data.openai_assistant_id.strip() or None

    agent.updated_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(agent)
    session.commit()
    session.refresh(agent)

    return AgentConfigResponse(
        system_prompt=agent.system_prompt,
        welcome_message=agent.welcome_message,
        llm_model=agent.llm_model,
        llm_provider=agent.llm_provider,
        price_per_message_credits=agent.price_per_message_credits,
        has_api_key=agent.has_api_key,
        api_key_preview=agent.api_key_preview,
        openai_assistant_id=agent.openai_assistant_id,
    )


# ── Hire / License for Chat Agents ──────────────────────────────


@router.post("/agents/{agent_id}/hire", response_model=HireResponse)
def hire_agent(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    # Check for existing active license (idempotent)
    existing = session.exec(
        select(AgentLicense).where(
            AgentLicense.agent_profile_id == agent_id,
            AgentLicense.buyer_id == user.id,
            AgentLicense.status == "active",
        )
    ).first()
    if existing:
        return HireResponse(
            license_id=existing.id,
            agent_id=agent.id,
            agent_slug=agent.slug,
            price_per_message=agent.price_per_message_credits,
            welcome_message=agent.welcome_message,
        )

    # Credit check for paid agents (need at least 1 message worth)
    if agent.price_per_message_credits > 0 and user.credit_balance < agent.price_per_message_credits:
        raise HTTPException(
            status_code=402,
            detail={
                "message": "Insufficient credits",
                "code": "insufficient_credits",
                "needed": agent.price_per_message_credits,
                "have": user.credit_balance,
            },
        )

    now = datetime.now(UTC).replace(tzinfo=None)
    license = AgentLicense(
        agent_profile_id=agent_id,
        buyer_id=user.id,
        pricing_plan_id=None,
        license_key=generate_license_key(),
        status="active",
        activated_at=now,
        period_start=now,
    )
    session.add(license)

    # Bump hire count
    agent.total_hires += 1
    session.add(agent)

    session.commit()
    session.refresh(license)

    return HireResponse(
        license_id=license.id,
        agent_id=agent.id,
        agent_slug=agent.slug,
        price_per_message=agent.price_per_message_credits,
        welcome_message=agent.welcome_message,
    )


@router.get("/agents/{agent_id}/license-status")
def get_license_status(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    license = session.exec(
        select(AgentLicense).where(
            AgentLicense.agent_profile_id == agent_id,
            AgentLicense.buyer_id == user.id,
            AgentLicense.status == "active",
        )
    ).first()
    return {"has_license": license is not None, "license_id": str(license.id) if license else None}


# ── Trial Endpoints ──────────────────────────────────────────────────


@router.get("/agents/{agent_id}/trial-status", response_model=TrialStatusResponse)
def get_trial_status(
    agent_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    trial = session.exec(
        select(TrialSession).where(
            TrialSession.user_id == user.id,
            TrialSession.agent_id == agent_id,
        )
    ).first()

    if not trial:
        return TrialStatusResponse(has_trial=False, messages_used=0, max_messages=3, exhausted=False)

    return TrialStatusResponse(
        has_trial=True,
        messages_used=trial.messages_used,
        max_messages=trial.max_messages,
        exhausted=trial.messages_used >= trial.max_messages,
    )


@router.post("/agents/{agent_id}/trial", response_model=TrialResponse)
def send_trial_message(
    agent_id: uuid.UUID,
    data: TrialSendRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    trial = session.exec(
        select(TrialSession).where(
            TrialSession.user_id == user.id,
            TrialSession.agent_id == agent_id,
        )
    ).first()

    if trial and trial.messages_used >= trial.max_messages:
        raise HTTPException(
            status_code=403,
            detail={"code": "trial_exhausted", "message": "Your 3 free messages have been used."},
        )

    if not trial:
        trial = TrialSession(user_id=user.id, agent_id=agent_id, messages_used=0, max_messages=3)
        session.add(trial)
        session.flush()

    # Call agent LLM if configured, otherwise use generic response
    response_text = ""
    if agent.system_prompt and (agent.has_api_key and agent.encrypted_api_key or has_platform_key()):
        try:
            from ..llm import call_agent, call_agent_platform
            if agent.has_api_key and agent.encrypted_api_key:
                result = call_agent(
                    encrypted_api_key=agent.encrypted_api_key,
                    system_prompt=agent.system_prompt,
                    messages=[{"role": "user", "content": data.message}],
                    model=agent.llm_model,
                    temperature=agent.temperature,
                    max_tokens=agent.max_tokens,
                )
            else:
                result = call_agent_platform(
                    system_prompt=agent.system_prompt,
                    messages=[{"role": "user", "content": data.message}],
                    model="claude-haiku-4-5-20251001",
                    temperature=agent.temperature,
                    max_tokens=agent.max_tokens,
                )
            response_text = result["content"]
        except Exception:
            response_text = f"Hi! I'm {agent.name}. This is a trial — hire me to unlock the full experience."
    else:
        response_text = f"Hi! I'm {agent.name}. This is a trial — hire me to unlock the full experience."

    trial.messages_used += 1
    session.add(trial)
    session.commit()

    remaining = trial.max_messages - trial.messages_used
    return TrialResponse(
        response=response_text,
        messages_used=trial.messages_used,
        max_messages=trial.max_messages,
        messages_remaining=remaining,
    )


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


# ── Pricing Plans (OpenClaw) ─────────────────────────────────────────


@router.post("/agents/{id}/pricing-plans", response_model=PricingPlanResponse, status_code=201)
def create_pricing_plan(
    id: uuid.UUID,
    data: PricingPlanCreateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(404, "Agent not found")
    if agent.listing_type != "openclaw":
        raise HTTPException(400, "Pricing plans are only for OpenClaw agents")

    plan = AgentPricingPlan(
        agent_profile_id=id,
        plan_name=data.plan_name,
        plan_description=data.plan_description,
        plan_type=data.plan_type,
        price_cents=data.price_cents,
        currency=data.currency,
        billing_interval=data.billing_interval,
        rental_duration_days=data.rental_duration_days,
        max_messages_per_period=data.max_messages_per_period,
        max_tokens_per_period=data.max_tokens_per_period,
    )
    session.add(plan)
    session.commit()
    session.refresh(plan)
    return plan


@router.get("/agents/{id}/pricing-plans", response_model=list[PricingPlanResponse])
def list_pricing_plans(
    id: uuid.UUID,
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    plans = session.exec(
        select(AgentPricingPlan).where(
            AgentPricingPlan.agent_profile_id == id,
            AgentPricingPlan.is_active == True,  # noqa: E712
        )
    ).all()
    return plans


@router.delete("/agents/{id}/pricing-plans/{plan_id}", status_code=204)
def delete_pricing_plan(
    id: uuid.UUID,
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(404, "Agent not found")
    plan = session.get(AgentPricingPlan, plan_id)
    if not plan or plan.agent_profile_id != id:
        raise HTTPException(404, "Plan not found")
    plan.is_active = False
    session.add(plan)
    session.commit()


# ── Purchase / Licenses ─────────────────────────────────────────


@router.post("/agents/{slug}/purchase", response_model=PurchaseResponse)
def purchase_agent_access(
    slug: str,
    data: PurchaseRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.exec(
        select(AgentProfile).where(AgentProfile.slug == slug)
    ).first()
    if not agent:
        raise HTTPException(404, "Agent not found")
    if agent.listing_type != "openclaw":
        raise HTTPException(400, "This agent is not an OpenClaw agent")

    plan = session.get(AgentPricingPlan, data.pricing_plan_id)
    if not plan or plan.agent_profile_id != agent.id or not plan.is_active:
        raise HTTPException(404, "Pricing plan not found")

    license = create_license(session, agent.id, user.id, plan)

    from ..config import get_settings
    settings = get_settings()
    base_url = settings.base_url if hasattr(settings, "base_url") else "http://localhost:8000"

    proxy_url = f"{base_url}/proxy/v1/messages"
    setup_instructions = (
        f"# Setup Instructions\n\n"
        f"1. Install the agent: {agent.openclaw_repo_url or 'See agent documentation'}\n"
        f"2. Set your base URL to: {proxy_url}\n"
        f"3. Use your license key as the API key\n\n"
        f"```python\n"
        f"import anthropic\n\n"
        f"client = anthropic.Anthropic(\n"
        f'    base_url="{proxy_url.rsplit("/v1/messages", 1)[0]}",\n'
        f'    api_key="{license.license_key}",\n'
        f")\n```"
    )

    return PurchaseResponse(
        license_id=license.id,
        license_key=license.license_key,
        status=license.status,
        expires_at=license.expires_at,
        proxy_url=proxy_url,
        setup_instructions=setup_instructions,
        plan=PricingPlanResponse.model_validate(plan),
    )


@router.get("/licenses/mine", response_model=list[LicenseResponse])
def list_my_licenses(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    licenses = session.exec(
        select(AgentLicense).where(AgentLicense.buyer_id == user.id)
    ).all()

    results = []
    for lic in licenses:
        resp = LicenseResponse.model_validate(lic)
        agent = session.get(AgentProfile, lic.agent_profile_id)
        if agent:
            resp.agent_name = agent.name
            resp.agent_slug = agent.slug
        plan = session.get(AgentPricingPlan, lic.pricing_plan_id)
        if plan:
            resp.plan_name = plan.plan_name
            resp.plan_type = plan.plan_type
            resp.max_messages_per_period = plan.max_messages_per_period
            resp.max_tokens_per_period = plan.max_tokens_per_period
        results.append(resp)

    return results


@router.get("/licenses/{license_id}/usage", response_model=UsageStatsResponse)
def get_license_usage(
    license_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    license = session.get(AgentLicense, license_id)
    if not license or license.buyer_id != user.id:
        raise HTTPException(404, "License not found")

    lic_resp = LicenseResponse.model_validate(license)
    agent = session.get(AgentProfile, license.agent_profile_id)
    if agent:
        lic_resp.agent_name = agent.name
        lic_resp.agent_slug = agent.slug
    plan = session.get(AgentPricingPlan, license.pricing_plan_id)
    if plan:
        lic_resp.plan_name = plan.plan_name
        lic_resp.plan_type = plan.plan_type
        lic_resp.max_messages_per_period = plan.max_messages_per_period
        lic_resp.max_tokens_per_period = plan.max_tokens_per_period

    logs = session.exec(
        select(ProxyUsageLog)
        .where(ProxyUsageLog.license_id == license_id)
        .order_by(ProxyUsageLog.created_at.desc())  # type: ignore[union-attr]
        .limit(50)
    ).all()

    return UsageStatsResponse(
        license=lic_resp,
        recent_usage=[UsageLogResponse.model_validate(log) for log in logs],
    )


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
