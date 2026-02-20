import hashlib
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_agent
from ..database import get_session
from ..escrow import refund_escrow, release_escrow
from ..evaluators import get_evaluator
from ..evaluators.base import EvaluationResult
from ..idempotency import check_idempotency, store_idempotency
from ..models import Agent, Artifact, Contract, EscrowLedger, Evaluation, TaskSpec
from ..rate_limit import check_rate_limit
from ..receipts import create_receipt
from ..schemas import (
    ArtifactCreate,
    ArtifactResponse,
    ContractResponse,
    EvaluationResponse,
)

router = APIRouter(tags=["contracts"])


@router.get("/contracts/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: uuid.UUID,
    session: Session = Depends(get_session),
    agent: Agent = Depends(get_current_agent),
):
    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    return ContractResponse.model_validate(contract)


@router.post(
    "/contracts/{contract_id}/artifacts",
    response_model=ArtifactResponse,
    status_code=201,
)
def submit_artifact(
    contract_id: uuid.UUID,
    data: ArtifactCreate,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.seller_agent_id != agent.id:
        raise HTTPException(403, "Only the seller can submit artifacts")
    if contract.status not in ("active", "submitted"):
        raise HTTPException(
            400, f"Cannot submit artifacts for contract in '{contract.status}' status"
        )

    checksum = hashlib.sha256(data.content_or_url.encode()).hexdigest()

    artifact = Artifact(
        contract_id=contract_id,
        kind=data.kind,
        content_or_url=data.content_or_url,
        checksum=checksum,
    )
    session.add(artifact)

    create_receipt(
        session, "artifact.submitted",
        {
            "artifact_id": str(artifact.id),
            "contract_id": str(contract_id),
            "kind": data.kind,
            "checksum": checksum,
        },
        contract_id=contract_id,
        agent_id=agent.id,
    )
    session.commit()
    session.refresh(artifact)

    return ArtifactResponse.model_validate(artifact)


@router.post("/contracts/{contract_id}/submit", response_model=ContractResponse)
def submit_contract(
    contract_id: uuid.UUID,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    """Seller marks contract as ready for evaluation."""
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.seller_agent_id != agent.id:
        raise HTTPException(403, "Only the seller can submit")
    if contract.status != "active":
        raise HTTPException(400, "Contract must be active to submit")

    contract.status = "submitted"
    session.add(contract)

    create_receipt(
        session, "contract.submitted",
        {"contract_id": str(contract_id)},
        contract_id=contract_id,
        agent_id=agent.id,
    )
    session.commit()
    session.refresh(contract)

    return ContractResponse.model_validate(contract)


@router.post(
    "/contracts/{contract_id}/evaluate", response_model=EvaluationResponse
)
def evaluate_contract(
    contract_id: uuid.UUID,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
):
    """Run the evaluator plugin against submitted artifacts."""
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.buyer_agent_id != agent.id:
        raise HTTPException(403, "Only the buyer can evaluate")
    if contract.status != "submitted":
        raise HTTPException(400, "Contract must be submitted for evaluation")

    task = session.get(TaskSpec, contract.task_id)
    artifacts = list(
        session.exec(
            select(Artifact).where(Artifact.contract_id == contract_id)
        ).all()
    )

    acceptance = task.acceptance_json
    evaluator_type = acceptance.get("type", "manual")

    try:
        evaluator = get_evaluator(evaluator_type)
        eval_result = evaluator.evaluate(artifacts, acceptance)
    except ValueError:
        eval_result = EvaluationResult(
            result="pass", score=None,
            rationale="No auto-evaluator available; manual pass",
        )
        evaluator_type = "manual"

    evaluation = Evaluation(
        contract_id=contract_id,
        evaluator_type=evaluator_type,
        result=eval_result.result,
        score=eval_result.score,
        rationale=eval_result.rationale,
    )
    session.add(evaluation)

    create_receipt(
        session, "contract.evaluated",
        {
            "contract_id": str(contract_id),
            "result": eval_result.result,
            "score": eval_result.score,
            "rationale": eval_result.rationale,
        },
        contract_id=contract_id,
        agent_id=agent.id,
    )
    session.commit()
    session.refresh(evaluation)

    return EvaluationResponse.model_validate(evaluation)


@router.post("/contracts/{contract_id}/accept", response_model=ContractResponse)
def accept_contract(
    contract_id: uuid.UUID,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Accept delivered work → release escrow → update reputation."""
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    cached = check_idempotency(idempotency_key, agent.id, session)
    if cached is not None:
        return cached

    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.buyer_agent_id != agent.id:
        raise HTTPException(403, "Only the buyer can accept")
    if contract.status != "submitted":
        raise HTTPException(400, "Contract must be submitted to accept")

    escrow = session.get(EscrowLedger, contract.escrow_id)
    release_escrow(session, escrow, contract.seller_agent_id)

    contract.status = "settled"
    task = session.get(TaskSpec, contract.task_id)
    task.status = "completed"

    # Update seller reputation
    seller = session.get(Agent, contract.seller_agent_id)
    seller.total_completed += 1
    total = seller.total_completed + seller.total_failed
    seller.reputation_score = seller.total_completed / total if total else 0.0
    session.add(seller)

    session.add_all([contract, task])

    create_receipt(
        session, "contract.accepted",
        {
            "contract_id": str(contract_id),
            "escrow_released_cents": escrow.released_cents,
            "seller_agent_id": str(contract.seller_agent_id),
        },
        contract_id=contract_id,
        agent_id=agent.id,
    )

    response_data = ContractResponse.model_validate(contract).model_dump(mode="json")

    if idempotency_key:
        store_idempotency(idempotency_key, agent.id, 200, response_data, session)

    session.commit()

    return response_data


@router.post("/contracts/{contract_id}/reject", response_model=ContractResponse)
def reject_contract(
    contract_id: uuid.UUID,
    agent: Agent = Depends(get_current_agent),
    session: Session = Depends(get_session),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Reject delivered work → dispute → refund escrow to buyer."""
    if not check_rate_limit(str(agent.id), agent.tier):
        raise HTTPException(429, "Rate limit exceeded")

    cached = check_idempotency(idempotency_key, agent.id, session)
    if cached is not None:
        return cached

    contract = session.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.buyer_agent_id != agent.id:
        raise HTTPException(403, "Only the buyer can reject")
    if contract.status != "submitted":
        raise HTTPException(400, "Contract must be submitted to reject")

    escrow = session.get(EscrowLedger, contract.escrow_id)
    refund_escrow(session, escrow, contract.buyer_agent_id)

    contract.status = "disputed"
    task = session.get(TaskSpec, contract.task_id)
    task.status = "disputed"

    # Update seller reputation
    seller = session.get(Agent, contract.seller_agent_id)
    seller.total_failed += 1
    total = seller.total_completed + seller.total_failed
    seller.reputation_score = seller.total_completed / total if total else 0.0
    session.add(seller)

    session.add_all([contract, task])

    create_receipt(
        session, "contract.rejected",
        {
            "contract_id": str(contract_id),
            "escrow_refunded_cents": escrow.refunded_cents,
        },
        contract_id=contract_id,
        agent_id=agent.id,
    )

    response_data = ContractResponse.model_validate(contract).model_dump(mode="json")

    if idempotency_key:
        store_idempotency(idempotency_key, agent.id, 200, response_data, session)

    session.commit()

    return response_data
