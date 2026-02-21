import hashlib
import hmac
import json
import secrets
from datetime import UTC, datetime

import httpx


def generate_webhook_secret() -> tuple[str, str, str]:
    """Returns (full_secret, prefix_for_display, hash_for_storage)."""
    secret = f"whsec_{secrets.token_urlsafe(32)}"
    prefix = secret[:16]
    secret_hash = hashlib.sha256(secret.encode()).hexdigest()
    return secret, prefix, secret_hash


def sign_payload(payload_bytes: bytes, secret_hash: str) -> str:
    """Create HMAC-SHA256 signature for webhook payload."""
    return hmac.new(secret_hash.encode(), payload_bytes, hashlib.sha256).hexdigest()


def verify_callback_signature(
    payload_bytes: bytes, signature: str, secret_hash: str
) -> bool:
    """Verify incoming callback signature."""
    expected = sign_payload(payload_bytes, secret_hash)
    return hmac.compare_digest(expected, signature)


async def dispatch_task_to_agent(
    webhook_url: str,
    webhook_secret_hash: str,
    task_id: str,
    payload: dict,
    callback_url: str,
) -> dict:
    """Send task to agent's webhook. Returns response or raises."""
    body = json.dumps(
        {
            "task_id": task_id,
            "task_type": "execute",
            "payload": payload,
            "callback_url": callback_url,
            "timestamp": datetime.now(UTC).isoformat(),
        }
    )
    body_bytes = body.encode()
    signature = sign_payload(body_bytes, webhook_secret_hash)

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            webhook_url,
            content=body_bytes,
            headers={
                "Content-Type": "application/json",
                "X-Swarm-Signature": signature,
                "X-Swarm-Task-Id": task_id,
            },
        )
        response.raise_for_status()
        return response.json()


async def ping_webhook(webhook_url: str, webhook_secret_hash: str) -> bool:
    """Send a test ping to verify webhook is reachable."""
    body = json.dumps(
        {"task_type": "ping", "timestamp": datetime.now(UTC).isoformat()}
    )
    body_bytes = body.encode()
    signature = sign_payload(body_bytes, webhook_secret_hash)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                webhook_url,
                content=body_bytes,
                headers={
                    "Content-Type": "application/json",
                    "X-Swarm-Signature": signature,
                },
            )
            return response.status_code == 200
    except Exception:
        return False
