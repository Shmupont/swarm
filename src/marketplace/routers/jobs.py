from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, text

from ..auth import get_current_user
from ..database import get_session
from ..models import User, AgentProfile, AgentLicense

router = APIRouter(prefix="/jobs", tags=["jobs"])


# ── Schemas ───────────────────────────────────────────────────────────

class StartJobRequest(BaseModel):
    agent_id: str
    config: dict[str, Any] = {}
    schedule: str = "daily"
    output_methods: list[str] = ["in_app"]
    notification_email: str | None = None


class UpdateJobRequest(BaseModel):
    status: str


class JobResponse(BaseModel):
    id: str
    user_id: str
    agent_id: str
    agent_name: str | None
    license_id: str | None
    config: dict[str, Any]
    billing_model: str
    schedule: str
    status: str
    last_run_at: str | None
    next_run_at: str
    run_count: int
    credits_spent_total: int
    output_methods: list[str]
    notification_email: str | None
    created_at: str
    latest_result: str | None = None


class JobRunResponse(BaseModel):
    id: str
    job_id: str
    started_at: str
    completed_at: str | None
    status: str
    result: str | None
    error: str | None
    credits_charged: int
    created_at: str


def _fmt_dt(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    return str(v)


def _row_to_job(row) -> dict:
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "agent_id": str(row["agent_id"]),
        "agent_name": row.get("agent_name"),
        "license_id": str(row["license_id"]) if row.get("license_id") else None,
        "config": row["config"] or {},
        "billing_model": row["billing_model"],
        "schedule": row["schedule"],
        "status": row["status"],
        "last_run_at": _fmt_dt(row.get("last_run_at")),
        "next_run_at": _fmt_dt(row["next_run_at"]),
        "run_count": row["run_count"],
        "credits_spent_total": row["credits_spent_total"],
        "output_methods": list(row["output_methods"] or ["in_app"]),
        "notification_email": row.get("notification_email"),
        "created_at": _fmt_dt(row["created_at"]),
        "latest_result": row.get("latest_result"),
    }


def _row_to_run(row) -> dict:
    return {
        "id": str(row["id"]),
        "job_id": str(row["job_id"]),
        "started_at": _fmt_dt(row["started_at"]),
        "completed_at": _fmt_dt(row.get("completed_at")),
        "status": row["status"],
        "result": row.get("result"),
        "error": row.get("error"),
        "credits_charged": row["credits_charged"],
        "created_at": _fmt_dt(row["created_at"]),
    }


def _calculate_next_run(schedule: str) -> datetime:
    now = datetime.now(timezone.utc)
    if schedule == "hourly":
        return now + timedelta(hours=1)
    elif schedule == "weekly":
        return now + timedelta(weeks=1)
    else:  # daily or once — trigger immediately
        return now


# ── Endpoints ─────────────────────────────────────────────────────────

@router.post("")
def start_job(
    data: StartJobRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Start a background automation job."""
    from sqlalchemy import text as sa_text

    engine = session.get_bind()

    # Verify agent exists
    try:
        agent_uuid = uuid.UUID(data.agent_id)
    except ValueError:
        raise HTTPException(400, "Invalid agent_id")

    agent = session.get(AgentProfile, agent_uuid)
    if not agent:
        raise HTTPException(404, "Agent not found")

    # Check user has a license (or create one for automation agents)
    with engine.connect() as conn:
        lic_row = conn.execute(
            sa_text("""
                SELECT id FROM agent_licenses
                WHERE agent_profile_id = :agent_id AND buyer_id = :user_id
                  AND status = 'active'
                LIMIT 1
            """),
            {"agent_id": agent_uuid, "user_id": user.id},
        ).fetchone()

    license_id = lic_row[0] if lic_row else None

    # Check user credit balance
    price_per_run = getattr(agent, "price_per_run_credits", None) or getattr(agent, "price_per_message_credits", None) or 50

    if user.credit_balance < price_per_run:
        raise HTTPException(402, f"Insufficient balance. Need at least {price_per_run} credits.")

    # Validate schedule
    valid_schedules = {"once", "hourly", "daily", "weekly"}
    if data.schedule not in valid_schedules:
        raise HTTPException(400, f"Invalid schedule. Choose from: {', '.join(valid_schedules)}")

    # Determine billing model from agent
    billing_model = getattr(agent, "billing_model", "per_answer") or "per_answer"
    if billing_model == "per_answer":
        billing_model = "per_run"

    next_run = datetime.now(timezone.utc)  # run immediately on first trigger

    with engine.connect() as conn:
        row = conn.execute(
            sa_text("""
                INSERT INTO background_jobs
                    (user_id, agent_id, license_id, config, billing_model, schedule,
                     status, next_run_at, output_methods, notification_email)
                VALUES
                    (:user_id, :agent_id, :license_id, :config::jsonb, :billing_model, :schedule,
                     'active', :next_run_at, :output_methods, :notification_email)
                RETURNING *
            """),
            {
                "user_id": user.id,
                "agent_id": agent_uuid,
                "license_id": license_id,
                "config": __import__("json").dumps(data.config),
                "billing_model": billing_model,
                "schedule": data.schedule,
                "next_run_at": next_run,
                "output_methods": data.output_methods,
                "notification_email": data.notification_email,
            },
        )
        conn.commit()
        job_row = dict(row.mappings().fetchone())

    job_row["agent_name"] = agent.name
    job_row["latest_result"] = None
    return _row_to_job(job_row)


@router.get("")
def list_jobs(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """List all background jobs for the authenticated user."""
    engine = session.get_bind()

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT bj.*,
                       ap.name as agent_name,
                       (
                           SELECT jr.result
                           FROM job_runs jr
                           WHERE jr.job_id = bj.id
                             AND jr.status = 'completed'
                           ORDER BY jr.created_at DESC
                           LIMIT 1
                       ) as latest_result
                FROM background_jobs bj
                JOIN agent_profiles ap ON ap.id = bj.agent_id
                WHERE bj.user_id = :user_id
                ORDER BY bj.created_at DESC
            """),
            {"user_id": user.id},
        ).fetchall()

    return [_row_to_job(dict(r._mapping)) for r in rows]


@router.get("/{job_id}")
def get_job(
    job_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get job details with last 5 runs."""
    engine = session.get_bind()

    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(400, "Invalid job_id")

    with engine.connect() as conn:
        job_row = conn.execute(
            text("""
                SELECT bj.*, ap.name as agent_name, NULL as latest_result
                FROM background_jobs bj
                JOIN agent_profiles ap ON ap.id = bj.agent_id
                WHERE bj.id = :job_id AND bj.user_id = :user_id
            """),
            {"job_id": job_uuid, "user_id": user.id},
        ).fetchone()

        if not job_row:
            raise HTTPException(404, "Job not found")

        runs = conn.execute(
            text("""
                SELECT * FROM job_runs
                WHERE job_id = :job_id
                ORDER BY created_at DESC
                LIMIT 5
            """),
            {"job_id": job_uuid},
        ).fetchall()

    return {
        "job": _row_to_job(dict(job_row._mapping)),
        "runs": [_row_to_run(dict(r._mapping)) for r in runs],
    }


@router.patch("/{job_id}")
def update_job(
    job_id: str,
    data: UpdateJobRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Pause, resume, or cancel a background job."""
    engine = session.get_bind()

    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(400, "Invalid job_id")

    valid_statuses = {"active", "paused", "cancelled"}
    if data.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Choose from: {', '.join(valid_statuses)}")

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                UPDATE background_jobs
                SET status = :status, updated_at = NOW()
                WHERE id = :job_id AND user_id = :user_id
                RETURNING *
            """),
            {"status": data.status, "job_id": job_uuid, "user_id": user.id},
        ).fetchone()

        if not row:
            raise HTTPException(404, "Job not found")

        # Fetch agent name
        agent_row = conn.execute(
            text("SELECT name FROM agent_profiles WHERE id = :agent_id"),
            {"agent_id": row._mapping["agent_id"]},
        ).fetchone()

        conn.commit()

    job_dict = dict(row._mapping)
    job_dict["agent_name"] = agent_row[0] if agent_row else None
    job_dict["latest_result"] = None
    return _row_to_job(job_dict)
