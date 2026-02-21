import json
import uuid

from sqlmodel import Session, select

from .models import IdempotencyRecord


def check_idempotency(
    key: str | None,
    agent_id: uuid.UUID,
    session: Session,
) -> dict | None:
    """Return cached response dict if the key was already used, else None."""
    if not key:
        return None
    record = session.exec(
        select(IdempotencyRecord).where(
            IdempotencyRecord.key == key,
            IdempotencyRecord.agent_id == agent_id,
        )
    ).first()
    if record:
        return json.loads(record.response_body)
    return None


def store_idempotency(
    key: str,
    agent_id: uuid.UUID,
    status: int,
    body: dict,
    session: Session,
) -> None:
    """Persist the response so duplicate requests get the same answer."""
    record = IdempotencyRecord(
        key=key,
        agent_id=agent_id,
        response_status=status,
        response_body=json.dumps(body, default=str),
    )
    session.add(record)
