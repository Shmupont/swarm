from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, text

from ..auth import get_current_user
from ..database import get_session
from ..models import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Schemas ───────────────────────────────────────────────────────────

class MarkReadRequest(BaseModel):
    notification_ids: list[str] | None = None
    all: bool = False


def _fmt_dt(v) -> str | None:
    if v is None:
        return None
    return str(v) if not hasattr(v, "isoformat") else v.isoformat()


def _row_to_notif(row) -> dict:
    m = dict(row._mapping)
    return {
        "id": str(m["id"]),
        "user_id": str(m["user_id"]),
        "job_id": str(m["job_id"]) if m.get("job_id") else None,
        "job_run_id": str(m["job_run_id"]) if m.get("job_run_id") else None,
        "type": m["type"],
        "title": m["title"],
        "body": m["body"],
        "read": m["read"],
        "created_at": _fmt_dt(m["created_at"]),
    }


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("")
def get_notifications(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get unread notifications for the authenticated user, newest first, limit 20."""
    engine = session.get_bind()

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT * FROM notifications
                WHERE user_id = :user_id AND read = FALSE
                ORDER BY created_at DESC
                LIMIT 20
            """),
            {"user_id": user.id},
        ).fetchall()

    return [_row_to_notif(r) for r in rows]


@router.post("/mark-read")
def mark_notifications_read(
    data: MarkReadRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Mark notifications as read."""
    engine = session.get_bind()

    with engine.connect() as conn:
        if data.all:
            conn.execute(
                text("""
                    UPDATE notifications
                    SET read = TRUE
                    WHERE user_id = :user_id AND read = FALSE
                """),
                {"user_id": user.id},
            )
        elif data.notification_ids:
            try:
                notif_uuids = [uuid.UUID(nid) for nid in data.notification_ids]
            except ValueError:
                raise HTTPException(400, "Invalid notification_id format")

            conn.execute(
                text("""
                    UPDATE notifications
                    SET read = TRUE
                    WHERE user_id = :user_id AND id = ANY(:ids)
                """),
                {"user_id": user.id, "ids": notif_uuids},
            )
        conn.commit()

    return {"ok": True}
