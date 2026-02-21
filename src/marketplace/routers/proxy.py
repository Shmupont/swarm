import logging
import time
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Request, Response
from sqlmodel import Session

from ..database import get_engine
from ..encryption import decrypt_api_key
from ..licenses import validate_license
from ..models import ProxyUsageLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/proxy", tags=["proxy"])

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

# Cost per million tokens (in cents)
MODEL_PRICING = {
    "claude-sonnet-4-20250514": {"input": 300, "output": 1500},
    "claude-haiku-4-5-20251001": {"input": 100, "output": 500},
    "claude-opus-4-6": {"input": 1500, "output": 7500},
}

PASS_THROUGH_HEADERS = {"anthropic-version", "anthropic-beta", "content-type"}


def _estimate_cost_cents(model: str, input_tokens: int, output_tokens: int) -> int:
    pricing = MODEL_PRICING.get(model, MODEL_PRICING["claude-sonnet-4-20250514"])
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost)


def _error_response(error_type: str, message: str, status_code: int = 400) -> Response:
    import json

    body = json.dumps({"type": "error", "error": {"type": error_type, "message": message}})
    return Response(content=body, status_code=status_code, media_type="application/json")


@router.post("/v1/messages")
async def proxy_messages(request: Request):
    # 1. Extract license key from headers
    license_key = request.headers.get("x-api-key") or ""
    if not license_key:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            license_key = auth_header[7:]

    if not license_key or not license_key.startswith("swrm_lic_"):
        return _error_response(
            "authentication_error",
            "Invalid or missing license key. Use your Swarm license key as the x-api-key header.",
            401,
        )

    # 2. Validate license
    engine = get_engine()
    with Session(engine) as session:
        try:
            result = validate_license(session, license_key)
        except ValueError as e:
            return _error_response("authentication_error", str(e), 403)

        license = result["license"]
        agent = result["agent"]
        plan = result["plan"]

        # 3. Decrypt creator's API key
        if not agent.encrypted_api_key:
            return _error_response(
                "invalid_request_error",
                "Agent has no API key configured. Contact the agent creator.",
                400,
            )

        try:
            real_api_key = decrypt_api_key(agent.encrypted_api_key)
        except Exception:
            return _error_response(
                "invalid_request_error",
                "Failed to decrypt agent API key. Contact the agent creator.",
                500,
            )

        # 4. Read raw request body
        body = await request.body()

        # 5. Build headers for Anthropic
        forward_headers = {"x-api-key": real_api_key, "content-type": "application/json"}
        for header_name in PASS_THROUGH_HEADERS - {"content-type"}:
            val = request.headers.get(header_name)
            if val:
                forward_headers[header_name] = val
        if "anthropic-version" not in forward_headers:
            forward_headers["anthropic-version"] = "2023-06-01"

        # 6. Forward to Anthropic
        start_time = time.time()
        input_tokens = 0
        output_tokens = 0
        total_tokens = 0
        model_used = "unknown"
        success = True
        error_message = None

        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                resp = await client.post(
                    ANTHROPIC_API_URL,
                    content=body,
                    headers=forward_headers,
                )
        except httpx.TimeoutException:
            response_time_ms = int((time.time() - start_time) * 1000)
            _log_usage(
                session, license, agent, "unknown", 0, 0, 0, 0, response_time_ms, False, "Upstream timeout"
            )
            return _error_response("api_error", "Request timed out", 504)
        except Exception as e:
            response_time_ms = int((time.time() - start_time) * 1000)
            _log_usage(
                session, license, agent, "unknown", 0, 0, 0, 0, response_time_ms, False, str(e)
            )
            return _error_response("api_error", "Failed to reach upstream API", 502)

        response_time_ms = int((time.time() - start_time) * 1000)

        # 7. Parse response for usage tracking
        if resp.status_code == 200:
            try:
                resp_json = resp.json()
                usage = resp_json.get("usage", {})
                input_tokens = usage.get("input_tokens", 0)
                output_tokens = usage.get("output_tokens", 0)
                total_tokens = input_tokens + output_tokens
                model_used = resp_json.get("model", "unknown")
            except Exception:
                pass
        else:
            success = False
            try:
                err_body = resp.json()
                error_message = err_body.get("error", {}).get("message", "Unknown error")
            except Exception:
                error_message = f"HTTP {resp.status_code}"

        # 8. Log usage and update license counters
        cost_cents = _estimate_cost_cents(model_used, input_tokens, output_tokens)
        _log_usage(
            session, license, agent, model_used, input_tokens, output_tokens,
            total_tokens, cost_cents, response_time_ms, success, error_message,
        )

        # 9. Return Anthropic's raw response
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=resp.headers.get("content-type", "application/json"),
        )


def _log_usage(
    session: Session,
    license,
    agent,
    model: str,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    cost_cents: int,
    response_time_ms: int,
    success: bool,
    error_message: str | None,
):
    now = datetime.now(UTC).replace(tzinfo=None)

    log = ProxyUsageLog(
        license_id=license.id,
        agent_profile_id=agent.id,
        buyer_id=license.buyer_id,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        estimated_cost_cents=cost_cents,
        response_time_ms=response_time_ms,
        success=success,
        error_message=error_message,
    )
    session.add(log)

    # Update license counters
    if success:
        license.total_messages += 1
        license.total_tokens_used += total_tokens
        license.total_cost_cents += cost_cents
        license.period_messages += 1
        license.period_tokens += total_tokens
        license.updated_at = now
        session.add(license)

    session.commit()
