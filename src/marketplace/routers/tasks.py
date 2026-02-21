import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, col, select

from ..auth import get_current_user, get_optional_user
from ..config import get_settings
from ..database import get_session
from ..models import AgentProfile, Task, TaskEvent, User
from ..schemas import (
    TaskCreateRequest,
    TaskEventResponse,
    TaskResponse,
    TaskResultCallback,
)
from ..webhook import dispatch_task_to_agent, verify_callback_signature

router = APIRouter(tags=["tasks"])


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _log_event(
    session: Session, task_id: uuid.UUID, event_type: str, event_data: dict
) -> None:
    session.add(
        TaskEvent(task_id=task_id, event_type=event_type, event_data=event_data)
    )


def _enrich_task_response(session: Session, task: Task) -> TaskResponse:
    resp = TaskResponse.model_validate(task)
    if task.agent_profile_id:
        agent = session.get(AgentProfile, task.agent_profile_id)
        if agent:
            resp.agent_name = agent.name
            resp.agent_slug = agent.slug
    buyer = session.get(User, task.buyer_id)
    if buyer:
        resp.buyer_display_name = buyer.display_name or buyer.email
    return resp


# ── Create & Dispatch ────────────────────────────────────────────────


@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    data: TaskCreateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = None

    task = Task(
        buyer_id=user.id,
        agent_profile_id=data.agent_profile_id,
        title=data.title,
        description=data.description,
        category=data.category,
        inputs_json=data.inputs_json,
        constraints_json=data.constraints_json,
        budget_cents=data.budget_cents,
        deadline=data.deadline,
    )

    # If agent specified, validate it exists and is docked
    if data.agent_profile_id:
        agent = session.get(AgentProfile, data.agent_profile_id)
        if not agent or not agent.is_docked:
            raise HTTPException(400, "Agent not found or not docked")
        if not agent.webhook_url:
            raise HTTPException(400, "Agent does not have a webhook configured")
        if agent.active_task_count >= agent.max_concurrent_tasks:
            raise HTTPException(429, "Agent is at max capacity")

        task.status = "assigned"

    session.add(task)
    _log_event(session, task.id, "posted", {"buyer_id": str(user.id)})

    if data.agent_profile_id:
        _log_event(
            session,
            task.id,
            "assigned",
            {"agent_id": str(data.agent_profile_id)},
        )

    session.commit()
    session.refresh(task)

    # If agent assigned and has webhook, dispatch async
    if task.agent_profile_id and agent and agent.webhook_url:
        try:
            settings = get_settings()
            callback_url = f"{settings.base_url}/hooks/task-result/{task.id}"
            result = await dispatch_task_to_agent(
                webhook_url=agent.webhook_url,
                webhook_secret_hash=agent.webhook_secret_hash or "",
                task_id=str(task.id),
                payload={
                    "title": task.title,
                    "description": task.description,
                    "inputs": task.inputs_json,
                    "constraints": task.constraints_json,
                },
                callback_url=callback_url,
            )
            task.status = "dispatched"
            task.dispatched_at = _utcnow()
            agent.active_task_count += 1
            session.add(task)
            session.add(agent)
            _log_event(session, task.id, "dispatched", {"response": result})
            session.commit()
        except Exception as e:
            task.status = "dispatch_failed"
            task.error_message = str(e)
            session.add(task)
            _log_event(session, task.id, "dispatch_failed", {"error": str(e)})
            session.commit()

    session.refresh(task)
    return _enrich_task_response(session, task)


# ── My Tasks (buyer) ─────────────────────────────────────────────────


@router.get("/tasks/mine", response_model=list[TaskResponse])
def list_my_tasks(
    status: str | None = None,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query = select(Task).where(Task.buyer_id == user.id)
    if status:
        query = query.where(Task.status == status)
    query = query.order_by(col(Task.created_at).desc())
    tasks = session.exec(query).all()
    return [_enrich_task_response(session, t) for t in tasks]


# ── Incoming Tasks (creator — tasks on my agents) ────────────────────


@router.get("/tasks/incoming", response_model=list[TaskResponse])
def list_incoming_tasks(
    status: str | None = None,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent_ids = session.exec(
        select(AgentProfile.id).where(AgentProfile.owner_id == user.id)
    ).all()
    if not agent_ids:
        return []

    query = select(Task).where(Task.agent_profile_id.in_(agent_ids))  # type: ignore[union-attr]
    if status:
        query = query.where(Task.status == status)
    query = query.order_by(col(Task.created_at).desc())
    tasks = session.exec(query).all()
    return [_enrich_task_response(session, t) for t in tasks]


# ── Task Detail ──────────────────────────────────────────────────────


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: uuid.UUID,
    user: User | None = Depends(get_optional_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    return _enrich_task_response(session, task)


# ── Task Events (timeline) ──────────────────────────────────────────


@router.get("/tasks/{task_id}/events", response_model=list[TaskEventResponse])
def get_task_events(
    task_id: uuid.UUID,
    user: User | None = Depends(get_optional_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    events = session.exec(
        select(TaskEvent)
        .where(TaskEvent.task_id == task_id)
        .order_by(col(TaskEvent.created_at).asc())
    ).all()
    return [TaskEventResponse.model_validate(e) for e in events]


# ── Accept Result (buyer) ────────────────────────────────────────────


@router.post("/tasks/{task_id}/accept-result", response_model=TaskResponse)
def accept_result(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task.buyer_id != user.id:
        raise HTTPException(403, "Only the buyer can accept results")
    if task.status != "completed":
        raise HTTPException(400, "Task is not in completed status")

    task.buyer_accepted = True
    task.updated_at = _utcnow()

    # Credit the agent
    if task.agent_profile_id:
        agent = session.get(AgentProfile, task.agent_profile_id)
        if agent:
            agent.total_earned_cents += task.budget_cents
            agent.total_hires += 1
            session.add(agent)

    session.add(task)
    _log_event(session, task.id, "buyer_accepted", {"buyer_id": str(user.id)})
    session.commit()
    session.refresh(task)
    return _enrich_task_response(session, task)


# ── Reject Result (buyer) ────────────────────────────────────────────


@router.post("/tasks/{task_id}/reject-result", response_model=TaskResponse)
def reject_result(
    task_id: uuid.UUID,
    feedback: str | None = None,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if task.buyer_id != user.id:
        raise HTTPException(403, "Only the buyer can reject results")
    if task.status != "completed":
        raise HTTPException(400, "Task is not in completed status")

    task.buyer_accepted = False
    task.buyer_feedback = feedback
    task.status = "assigned"  # back to assigned so agent can retry
    task.result_json = None
    task.result_summary = None
    task.completed_at = None
    task.updated_at = _utcnow()

    session.add(task)
    _log_event(
        session,
        task.id,
        "buyer_rejected",
        {"buyer_id": str(user.id), "feedback": feedback},
    )
    session.commit()
    session.refresh(task)
    return _enrich_task_response(session, task)


# ── Agent Callback (no auth — verified via HMAC) ─────────────────────


@router.post("/hooks/task-result/{task_id}")
async def receive_task_result(
    task_id: uuid.UUID,
    data: TaskResultCallback,
    request: Request,
    session: Session = Depends(get_session),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    # Verify HMAC signature
    agent = session.get(AgentProfile, task.agent_profile_id)
    if not agent or not agent.webhook_secret_hash:
        raise HTTPException(400, "Agent not found or webhook not configured")

    body = await request.body()
    signature = request.headers.get("X-Swarm-Signature", "")
    if not verify_callback_signature(body, signature, agent.webhook_secret_hash):
        raise HTTPException(401, "Invalid signature")

    # Update task with results
    if data.status == "completed":
        task.status = "completed"
        task.completed_at = _utcnow()
        task.result_json = data.result
        if data.result:
            task.result_summary = data.result.get("summary")
            task.execution_time_seconds = data.result.get("execution_time_seconds")
            task.confidence_score = data.result.get("confidence_score")
        agent.active_task_count = max(0, agent.active_task_count - 1)
        agent.tasks_completed += 1
    elif data.status == "failed":
        task.status = "failed"
        task.failed_at = _utcnow()
        task.error_message = data.error
        agent.active_task_count = max(0, agent.active_task_count - 1)

    task.updated_at = _utcnow()
    session.add(task)
    session.add(agent)
    _log_event(
        session,
        task.id,
        data.status,
        {"result": data.result, "error": data.error},
    )
    session.commit()

    return {"status": "received"}
