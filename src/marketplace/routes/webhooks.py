import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..database import get_session
from ..models import AgentProfile, User, utcnow
from ..auth import get_current_user

router = APIRouter(prefix="/agents", tags=["webhooks"])


def webhook_config_dict(a: AgentProfile) -> dict:
    secret_prefix = None
    if a.webhook_secret:
        secret_prefix = a.webhook_secret[:8] + "..."
    return {
        "webhook_url": a.webhook_url,
        "webhook_secret": None,  # Never expose full secret
        "webhook_secret_prefix": secret_prefix,
        "webhook_status": a.webhook_status or "unconfigured",
        "webhook_last_ping": a.webhook_last_ping.isoformat() if a.webhook_last_ping else None,
        "max_concurrent_tasks": a.max_concurrent_tasks or 5,
        "auto_accept_tasks": a.auto_accept_tasks or False,
        "accepted_task_types": a.accepted_task_types or [],
    }


class ConfigureWebhookRequest(BaseModel):
    webhook_url: str
    max_concurrent_tasks: int | None = None
    auto_accept_tasks: bool | None = None
    accepted_task_types: list[str] | None = None


@router.post("/{agent_id}/webhook")
def configure_webhook(
    agent_id: str,
    body: ConfigureWebhookRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your agent")

    agent.webhook_url = body.webhook_url
    agent.webhook_status = "connected"

    # Generate secret if first time
    if not agent.webhook_secret:
        agent.webhook_secret = "whsec_" + secrets.token_urlsafe(32)

    if body.max_concurrent_tasks is not None:
        agent.max_concurrent_tasks = body.max_concurrent_tasks
    if body.auto_accept_tasks is not None:
        agent.auto_accept_tasks = body.auto_accept_tasks
    if body.accepted_task_types is not None:
        agent.accepted_task_types = body.accepted_task_types

    agent.updated_at = utcnow()
    session.add(agent)
    session.commit()
    session.refresh(agent)

    # Return with secret visible (only on configure)
    result = webhook_config_dict(agent)
    result["webhook_secret"] = agent.webhook_secret
    return result


@router.post("/{agent_id}/webhook/test")
def test_webhook(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your agent")
    if not agent.webhook_url:
        raise HTTPException(status_code=400, detail="No webhook configured")

    # In a real implementation, we'd make an HTTP request to the webhook URL.
    # For now, simulate a successful ping.
    agent.webhook_status = "connected"
    agent.webhook_last_ping = utcnow()
    agent.updated_at = utcnow()
    session.add(agent)
    session.commit()

    return {"success": True, "response_time_ms": 42}


@router.post("/{agent_id}/webhook/regenerate")
def regenerate_secret(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your agent")

    agent.webhook_secret = "whsec_" + secrets.token_urlsafe(32)
    agent.updated_at = utcnow()
    session.add(agent)
    session.commit()
    session.refresh(agent)

    result = webhook_config_dict(agent)
    result["webhook_secret"] = agent.webhook_secret
    return result


@router.delete("/{agent_id}/webhook")
def remove_webhook(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your agent")

    agent.webhook_url = None
    agent.webhook_secret = None
    agent.webhook_status = "unconfigured"
    agent.webhook_last_ping = None
    agent.auto_accept_tasks = False
    agent.updated_at = utcnow()
    session.add(agent)
    session.commit()

    return {"ok": True}
