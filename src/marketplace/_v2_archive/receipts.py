import hashlib
import hmac
import json
import uuid

from sqlmodel import Session

from .config import get_settings
from .models import Receipt


def sign_payload(payload: dict, key: str) -> str:
    """HMAC-SHA256 signature over the JSON-serialised payload."""
    raw = json.dumps(payload, sort_keys=True, default=str).encode()
    return hmac.new(key.encode(), raw, hashlib.sha256).hexdigest()


def create_receipt(
    session: Session,
    event_type: str,
    payload: dict,
    *,
    contract_id: uuid.UUID | None = None,
    agent_id: uuid.UUID | None = None,
) -> Receipt:
    settings = get_settings()
    signature = sign_payload(payload, settings.platform_signing_key)

    receipt = Receipt(
        contract_id=contract_id,
        agent_id=agent_id,
        event_type=event_type,
        event_payload=payload,
        platform_signature=signature,
    )
    session.add(receipt)
    return receipt
