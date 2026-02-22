"""
Google A2A (Agent-to-Agent) Protocol Integration.
Spec: https://google.github.io/A2A
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..database import get_session
from ..models import AgentProfile, Task

router = APIRouter(prefix="/a2a", tags=["A2A"])

RAILWAY_URL = "https://swarm-api.railway.app"  # override via env if needed


# ── Helpers ──────────────────────────────────────────────────────────


def _build_agent_card(agent: AgentProfile) -> dict:
    skills = [
        {
            "id": cap.lower().replace(" ", "-"),
            "name": cap,
            "description": f"{agent.name} can handle: {cap}",
        }
        for cap in (agent.capabilities or [])
    ] or [
        {
            "id": "general",
            "name": "General Assistant",
            "description": agent.tagline or agent.description or "",
        }
    ]

    return {
        "name": agent.name,
        "description": agent.tagline or agent.description or "",
        "url": f"{RAILWAY_URL}/a2a/agents/{agent.id}",
        "version": "1.0",
        "capabilities": {
            "streaming": False,
            "pushNotifications": bool(agent.webhook_url),
        },
        "skills": skills,
        "defaultInputModes": ["text/plain"],
        "defaultOutputModes": ["text/plain"],
        "swarm_meta": {
            "agent_id": str(agent.id),
            "slug": agent.slug,
            "category": agent.category,
            "is_docked": agent.is_docked,
            "status": agent.status,
        },
    }


# ── Schemas ──────────────────────────────────────────────────────────


class A2AMessagePart(BaseModel):
    type: str = "text"
    text: str


class A2AMessage(BaseModel):
    role: str = "user"
    parts: list[A2AMessagePart]


class A2ATaskRequest(BaseModel):
    id: str  # client-provided task ID
    message: A2AMessage


# ── Endpoints ────────────────────────────────────────────────────────


@router.get("/agents/{agent_id}/agent.json")
def get_agent_card(agent_id: uuid.UUID, session: Session = Depends(get_session)):
    """Return A2A Agent Card for the given agent."""
    agent = session.get(AgentProfile, agent_id)
    if not agent or agent.status != "active":
        raise HTTPException(404, "Agent not found or inactive")
    return _build_agent_card(agent)


@router.post("/agents/{agent_id}/tasks", status_code=201)
def create_a2a_task(
    agent_id: uuid.UUID,
    req: A2ATaskRequest,
    session: Session = Depends(get_session),
):
    """
    Accept an A2A task, map to SWARM Task model.
    Dispatches to agent webhook if configured.
    Returns A2A task response with status 'submitted'.
    """
    agent = session.get(AgentProfile, agent_id)
    if not agent or agent.status != "active":
        raise HTTPException(404, "Agent not found or inactive")

    # Extract text from A2A message parts
    text_content = " ".join(
        p.text for p in req.message.parts if p.type == "text"
    )

    # Use the agent owner as the buyer (system-initiated task)
    task = Task(
        buyer_id=agent.owner_id,
        agent_profile_id=agent.id,
        title=f"A2A Task: {text_content[:80]}",
        description=text_content,
        category=agent.category,
        budget_cents=0,
        deadline=datetime(2099, 12, 31),
        status="posted",
        inputs_json={
            "a2a_client_task_id": req.id,
            "a2a_message": {
                "role": req.message.role,
                "parts": [{"type": p.type, "text": p.text} for p in req.message.parts],
            },
        },
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    # Optionally dispatch to webhook
    if agent.webhook_url:
        try:
            import httpx
            httpx.post(
                agent.webhook_url,
                json={
                    "event": "a2a_task",
                    "task_id": str(task.id),
                    "a2a_client_task_id": req.id,
                    "message": {
                        "role": req.message.role,
                        "parts": [{"type": p.type, "text": p.text} for p in req.message.parts],
                    },
                },
                timeout=5,
            )
        except Exception:
            pass  # best-effort dispatch

    return {
        "id": req.id,
        "swarm_task_id": str(task.id),
        "status": "submitted",
        "agent": {
            "id": str(agent.id),
            "name": agent.name,
        },
        "created_at": task.created_at.isoformat(),
    }


@router.get("/agents/{agent_id}/tasks/{task_id}")
def get_a2a_task(
    agent_id: uuid.UUID,
    task_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    """Return A2A task status."""
    task = session.get(Task, task_id)
    if not task or task.agent_profile_id != agent_id:
        raise HTTPException(404, "Task not found")

    # Map SWARM status to A2A status
    status_map = {
        "posted": "submitted",
        "assigned": "submitted",
        "dispatched": "working",
        "accepted": "working",
        "in_progress": "working",
        "completed": "completed",
        "failed": "failed",
        "cancelled": "canceled",
        "expired": "failed",
    }
    a2a_status = status_map.get(task.status, "submitted")

    response: dict = {
        "id": str(task.id),
        "swarm_task_id": str(task.id),
        "status": a2a_status,
        "created_at": task.created_at.isoformat(),
    }

    if task.status == "completed" and task.result_json:
        response["result"] = {
            "role": "agent",
            "parts": [{"type": "text", "text": task.result_summary or str(task.result_json)}],
        }
    elif task.status == "failed":
        response["error"] = task.error_message or "Task failed"

    return response


@router.get("/registry")
def get_a2a_registry(session: Session = Depends(get_session)):
    """Return all active agents as A2A Agent Cards — SWARM's public registry."""
    agents = session.exec(
        select(AgentProfile).where(
            AgentProfile.status == "active",
            AgentProfile.is_docked == True,  # noqa: E712
        )
    ).all()
    return [_build_agent_card(a) for a in agents]
