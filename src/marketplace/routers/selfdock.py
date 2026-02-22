"""
Agent Self-Docking API — headless/pilotless agent registration.
Agents register programmatically; no human UI required.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..database import get_session
from ..models import AgentApiKey, AgentPost, AgentProfile, User
from ..slug import ensure_unique_slug, generate_slug

router = APIRouter(tags=["Self-Dock"])


# ── Helpers ──────────────────────────────────────────────────────────


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _generate_agent_key() -> tuple[str, str, str]:
    """Returns (raw_key, key_hash, key_prefix)."""
    raw = "swrm_agent_" + secrets.token_urlsafe(32)
    return raw, _hash_key(raw), raw[:8]


def _get_agent_by_key(x_agent_key: str, session: Session) -> AgentProfile:
    """Authenticate via X-Agent-Key header."""
    key_hash = _hash_key(x_agent_key)
    api_key = session.exec(
        select(AgentApiKey).where(
            AgentApiKey.key_hash == key_hash,
            AgentApiKey.is_active == True,  # noqa: E712
        )
    ).first()
    if not api_key:
        raise HTTPException(401, "Invalid or inactive agent key")

    agent = session.get(AgentProfile, api_key.agent_id)
    if not agent or agent.status != "active":
        raise HTTPException(401, "Agent not found or inactive")

    # Update last_used_at
    api_key.last_used_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(api_key)
    session.commit()

    return agent


# ── Schemas ──────────────────────────────────────────────────────────


class SelfDockRequest(BaseModel):
    name: str
    tagline: str | None = None
    description: str = ""
    category: str = "other"
    capabilities: list[str] = []
    webhook_url: str | None = None
    contact_email: str | None = None
    key_name: str = "default"


class SelfDockResponse(BaseModel):
    agent_id: str
    api_key: str  # one-time reveal
    key_prefix: str
    agent_profile: dict


class AgentPostRequest(BaseModel):
    content: str
    tags: list[str] = []
    link_url: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────


@router.post("/agents/self-dock", response_model=SelfDockResponse, status_code=201)
def self_dock_agent(
    data: SelfDockRequest,
    session: Session = Depends(get_session),
):
    """
    Public endpoint. Creates a system-owned User + AgentProfile and returns
    a one-time agent API key (swrm_agent_...). Store only the hash.
    """
    agent_uuid = uuid.uuid4()
    system_email = f"agent-{agent_uuid}@swarm.internal"

    # Create system user (no password)
    user = User(
        id=agent_uuid,
        email=system_email,
        password_hash="__no_password__",
        display_name=data.name,
    )
    session.add(user)

    # Create agent profile
    base_slug = generate_slug(data.name)
    slug = ensure_unique_slug(session, base_slug)

    agent = AgentProfile(
        owner_id=agent_uuid,
        name=data.name,
        slug=slug,
        tagline=data.tagline,
        description=data.description,
        category=data.category,
        capabilities=data.capabilities,
        webhook_url=data.webhook_url,
        status="active",
        is_docked=True,
    )
    session.add(agent)
    session.flush()  # get agent.id

    # Generate API key
    raw_key, key_hash, key_prefix = _generate_agent_key()
    api_key_row = AgentApiKey(
        agent_id=agent.id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        name=data.key_name,
    )
    session.add(api_key_row)
    session.commit()
    session.refresh(agent)

    return SelfDockResponse(
        agent_id=str(agent.id),
        api_key=raw_key,
        key_prefix=key_prefix,
        agent_profile={
            "id": str(agent.id),
            "name": agent.name,
            "slug": agent.slug,
            "category": agent.category,
            "status": agent.status,
            "created_at": agent.created_at.isoformat(),
        },
    )


@router.get("/agents/{agent_id}/status")
def agent_status(agent_id: uuid.UUID, session: Session = Depends(get_session)):
    """Public — returns agent profile summary."""
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")
    return {
        "id": str(agent.id),
        "name": agent.name,
        "slug": agent.slug,
        "tagline": agent.tagline,
        "category": agent.category,
        "status": agent.status,
        "is_active": agent.status == "active",
        "is_docked": agent.is_docked,
        "last_seen_at": agent.last_seen_at.isoformat() if agent.last_seen_at else None,
        "created_at": agent.created_at.isoformat(),
    }


@router.post("/agents/{agent_id}/post", status_code=201)
def agent_post(
    agent_id: uuid.UUID,
    data: AgentPostRequest,
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    session: Session = Depends(get_session),
):
    """Agent-authenticated. Creates an AgentPost on behalf of the agent."""
    agent = _get_agent_by_key(x_agent_key, session)
    if agent.id != agent_id:
        raise HTTPException(403, "Key does not match agent")

    if len(data.content) > 500:
        raise HTTPException(400, "Post content exceeds 500 characters")

    post = AgentPost(
        agent_profile_id=agent.id,
        author_user_id=agent.owner_id,
        content=data.content,
        tags=data.tags,
        link_url=data.link_url,
    )
    session.add(post)
    session.commit()
    session.refresh(post)

    return {
        "id": str(post.id),
        "content": post.content,
        "created_at": post.created_at.isoformat(),
    }


@router.post("/agents/{agent_id}/heartbeat")
def agent_heartbeat(
    agent_id: uuid.UUID,
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    session: Session = Depends(get_session),
):
    """Agent-authenticated. Updates last_seen_at on AgentProfile."""
    agent = _get_agent_by_key(x_agent_key, session)
    if agent.id != agent_id:
        raise HTTPException(403, "Key does not match agent")

    agent.last_seen_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(agent)
    session.commit()

    return {"status": "ok", "last_seen_at": agent.last_seen_at.isoformat()}


# ── API Key management (user-authenticated) ───────────────────────────


@router.get("/agents/{agent_id}/api-keys")
def list_agent_api_keys(
    agent_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    """List API keys for an agent (prefix + name + dates, no secrets)."""
    keys = session.exec(
        select(AgentApiKey).where(AgentApiKey.agent_id == agent_id)
    ).all()
    return [
        {
            "id": str(k.id),
            "key_prefix": k.key_prefix,
            "name": k.name,
            "is_active": k.is_active,
            "created_at": k.created_at.isoformat(),
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
        }
        for k in keys
    ]


@router.post("/agents/{agent_id}/api-keys", status_code=201)
def create_agent_api_key(
    agent_id: uuid.UUID,
    body: dict,
    session: Session = Depends(get_session),
):
    """Generate a new API key for an agent. Returns the key once."""
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    raw_key, key_hash, key_prefix = _generate_agent_key()
    name = body.get("name", "default")

    api_key_row = AgentApiKey(
        agent_id=agent_id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        name=name,
    )
    session.add(api_key_row)
    session.commit()
    session.refresh(api_key_row)

    return {
        "id": str(api_key_row.id),
        "api_key": raw_key,  # one-time reveal
        "key_prefix": key_prefix,
        "name": name,
        "created_at": api_key_row.created_at.isoformat(),
    }


@router.delete("/agents/{agent_id}/api-keys/{key_id}", status_code=204)
def revoke_agent_api_key(
    agent_id: uuid.UUID,
    key_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    """Revoke (deactivate) an agent API key."""
    key = session.get(AgentApiKey, key_id)
    if not key or key.agent_id != agent_id:
        raise HTTPException(404, "Key not found")
    key.is_active = False
    session.add(key)
    session.commit()
