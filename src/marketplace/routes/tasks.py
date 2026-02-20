from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, col

from ..database import get_session
from ..models import Task, TaskEvent, AgentProfile, User, utcnow, new_id
from ..auth import get_current_user

router = APIRouter(prefix="/tasks", tags=["tasks"])


def task_to_dict(t: Task, session: Session) -> dict:
    agent = session.get(AgentProfile, t.agent_profile_id) if t.agent_profile_id else None
    buyer = session.get(User, t.buyer_id)

    return {
        "id": t.id,
        "buyer_id": t.buyer_id,
        "agent_profile_id": t.agent_profile_id,
        "title": t.title,
        "description": t.description,
        "category": t.category,
        "inputs_json": t.inputs_json or {},
        "constraints_json": t.constraints_json or {},
        "budget_cents": t.budget_cents,
        "currency": t.currency,
        "deadline": t.deadline.isoformat() if t.deadline else None,
        "status": t.status,
        "dispatched_at": t.dispatched_at.isoformat() if t.dispatched_at else None,
        "accepted_at": t.accepted_at.isoformat() if t.accepted_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "failed_at": t.failed_at.isoformat() if t.failed_at else None,
        "result_json": t.result_json,
        "result_summary": t.result_summary,
        "execution_time_seconds": t.execution_time_seconds,
        "confidence_score": t.confidence_score,
        "error_message": t.error_message,
        "buyer_accepted": t.buyer_accepted,
        "buyer_feedback": t.buyer_feedback,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
        "agent_name": agent.name if agent else None,
        "agent_slug": agent.slug if agent else None,
        "buyer_display_name": buyer.display_name if buyer else None,
    }


def add_event(session: Session, task_id: str, event_type: str, data: dict = {}):
    event = TaskEvent(task_id=task_id, event_type=event_type, event_data=data)
    session.add(event)


# ── Create Task (Buyer) ──────────────────────────────────────

class CreateTaskRequest(BaseModel):
    agent_profile_id: str | None = None
    title: str
    description: str = ""
    category: str = "other"
    inputs_json: dict = {}
    constraints_json: dict = {}
    budget_cents: int = 0
    deadline: str | None = None


@router.post("")
def create_task(
    body: CreateTaskRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Validate agent exists if specified
    agent = None
    if body.agent_profile_id:
        agent = session.get(AgentProfile, body.agent_profile_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

    deadline = None
    if body.deadline:
        try:
            deadline = datetime.fromisoformat(body.deadline.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid deadline format")

    task = Task(
        buyer_id=user.id,
        agent_profile_id=body.agent_profile_id,
        title=body.title,
        description=body.description,
        category=body.category or (agent.category if agent else "other"),
        inputs_json=body.inputs_json,
        constraints_json=body.constraints_json,
        budget_cents=body.budget_cents,
        deadline=deadline,
        status="assigned" if body.agent_profile_id else "posted",
    )
    session.add(task)
    session.flush()

    add_event(session, task.id, "created", {"buyer_id": user.id})

    # Auto-dispatch if agent has webhook and auto_accept enabled
    if agent and agent.webhook_url and agent.auto_accept_tasks:
        task.status = "dispatched"
        task.dispatched_at = utcnow()
        add_event(session, task.id, "dispatched", {"agent_id": agent.id})

    session.commit()
    session.refresh(task)

    # Increment agent hire count
    if agent:
        agent.total_hires += 1
        session.add(agent)
        session.commit()

    return task_to_dict(task, session)


# ── List My Tasks (Buyer) ────────────────────────────────────

@router.get("/mine")
def my_tasks(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    tasks = session.exec(
        select(Task)
        .where(Task.buyer_id == user.id)
        .order_by(col(Task.created_at).desc())
    ).all()
    return [task_to_dict(t, session) for t in tasks]


# ── Incoming Tasks (Creator — tasks assigned to my agents) ───

@router.get("/incoming")
def incoming_tasks(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    my_agent_ids = [
        a.id for a in session.exec(
            select(AgentProfile).where(AgentProfile.owner_id == user.id)
        ).all()
    ]
    if not my_agent_ids:
        return []

    tasks = session.exec(
        select(Task)
        .where(col(Task.agent_profile_id).in_(my_agent_ids))
        .order_by(col(Task.created_at).desc())
    ).all()
    return [task_to_dict(t, session) for t in tasks]


# ── Get Task Detail ──────────────────────────────────────────

@router.get("/{task_id}")
def get_task(
    task_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Authorization: buyer or agent owner
    is_buyer = task.buyer_id == user.id
    is_owner = False
    if task.agent_profile_id:
        agent = session.get(AgentProfile, task.agent_profile_id)
        is_owner = agent and agent.owner_id == user.id

    if not is_buyer and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized")

    return task_to_dict(task, session)


# ── Get Task Events ──────────────────────────────────────────

@router.get("/{task_id}/events")
def get_task_events(
    task_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    events = session.exec(
        select(TaskEvent)
        .where(TaskEvent.task_id == task_id)
        .order_by(col(TaskEvent.created_at).asc())
    ).all()

    return [
        {
            "id": e.id,
            "task_id": e.task_id,
            "event_type": e.event_type,
            "event_data": e.event_data or {},
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


# ── Accept Task Result (Buyer) ───────────────────────────────

class ResultFeedback(BaseModel):
    feedback: str | None = None


@router.post("/{task_id}/accept-result")
def accept_result(
    task_id: str,
    body: ResultFeedback,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.buyer_id != user.id:
        raise HTTPException(status_code=403, detail="Only the buyer can accept results")
    if task.status != "completed":
        raise HTTPException(status_code=400, detail="Task is not in completed state")

    task.buyer_accepted = True
    task.buyer_feedback = body.feedback
    task.updated_at = utcnow()
    session.add(task)

    add_event(session, task.id, "result_accepted", {"feedback": body.feedback})

    # Pay the agent
    if task.agent_profile_id:
        agent = session.get(AgentProfile, task.agent_profile_id)
        if agent:
            agent.total_earned_cents += task.budget_cents
            agent.tasks_completed += 1
            session.add(agent)

    session.commit()
    session.refresh(task)
    return task_to_dict(task, session)


# ── Reject Task Result (Buyer) ───────────────────────────────

@router.post("/{task_id}/reject-result")
def reject_result(
    task_id: str,
    body: ResultFeedback,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.buyer_id != user.id:
        raise HTTPException(status_code=403, detail="Only the buyer can reject results")
    if task.status != "completed":
        raise HTTPException(status_code=400, detail="Task is not in completed state")

    task.buyer_accepted = False
    task.buyer_feedback = body.feedback
    task.status = "failed"
    task.failed_at = utcnow()
    task.updated_at = utcnow()
    session.add(task)

    add_event(session, task.id, "result_rejected", {"feedback": body.feedback})

    session.commit()
    session.refresh(task)
    return task_to_dict(task, session)
