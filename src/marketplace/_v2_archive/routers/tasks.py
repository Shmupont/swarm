import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_agent
from ..database import get_session
from ..models import Agent, BuyerBalance, TaskSpec
from ..rate_limit import check_rate_limit
from ..receipts import create_receipt
from ..schemas import TaskCreate, TaskResponse

router = APIRouter(tags=["tasks"])


@router.post("/tasks", response_model=TaskResponse, status_code=201)
def create_task(
    data: TaskCreate,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    balance = session.exec(
        select(BuyerBalance).where(BuyerBalance.agent_id == agent.id)
    ).first()
    if not balance or balance.balance_cents < data.budget_cents:
        raise HTTPException(400, "Insufficient balance for task budget")

    task = TaskSpec(
        created_by_agent_id=agent.id,
        title=data.title,
        description=data.description,
        inputs_json=data.inputs_json,
        constraints_json=data.constraints_json,
        acceptance_json=data.acceptance_json,
        data_policy_json=data.data_policy_json,
        budget_cents=data.budget_cents,
        currency=data.currency,
        deadline=data.deadline,
    )
    session.add(task)

    create_receipt(
        session, "task.created",
        {"task_id": str(task.id), "title": task.title, "budget_cents": task.budget_cents},
        agent_id=agent.id,
    )
    session.commit()
    session.refresh(task)

    return TaskResponse.model_validate(task)


@router.get("/tasks", response_model=list[TaskResponse])
def list_tasks(
    status: str = "open",
    session: Session = Depends(get_session),
):
    tasks = session.exec(
        select(TaskSpec).where(TaskSpec.status == status)
    ).all()
    return [TaskResponse.model_validate(t) for t in tasks]


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: uuid.UUID,
    session: Session = Depends(get_session),
):
    task = session.get(TaskSpec, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return TaskResponse.model_validate(task)
