import logging
import time
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Request, Response
from sqlmodel import Session

from ..database import get_engine
from ..encryption import decrypt_api_key
from ..licenses import validate_license
from ..models import AgentProfile, CreatorEarnings, ProxyUsageLog, User

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

        # 3. Credit check — if plan uses credits billing
        buyer: User | None = None
        credits_to_charge = 0
        if plan.plan_type == "credits" and plan.credits_per_message is not None:
            buyer = session.get(User, license.buyer_id)
            if not buyer:
                return _error_response("authentication_error", "Buyer account not found", 403)
            credits_to_charge = plan.credits_per_message
            if buyer.credit_balance < credits_to_charge:
                return _error_response(
                    "payment_required",
                    f"Insufficient credits. Need {credits_to_charge}, have {buyer.credit_balance}. "
                    "Top up at /credits.",
                    402,
                )

        # 4. Decrypt creator's API key
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

        # 5. Read raw request body
        body = await request.body()

        # 6. Build headers for Anthropic
        forward_headers = {"x-api-key": real_api_key, "content-type": "application/json"}
        for header_name in PASS_THROUGH_HEADERS - {"content-type"}:
            val = request.headers.get(header_name)
            if val:
                forward_headers[header_name] = val
        if "anthropic-version" not in forward_headers:
            forward_headers["anthropic-version"] = "2023-06-01"

        # 7. Forward to Anthropic
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
                session, license, agent, "unknown", 0, 0, 0, 0, response_time_ms, False,
                "Upstream timeout", 0, 0, 0,
            )
            return _error_response("api_error", "Request timed out", 504)
        except Exception as e:
            response_time_ms = int((time.time() - start_time) * 1000)
            _log_usage(
                session, license, agent, "unknown", 0, 0, 0, 0, response_time_ms, False,
                str(e), 0, 0, 0,
            )
            return _error_response("api_error", "Failed to reach upstream API", 502)

        response_time_ms = int((time.time() - start_time) * 1000)

        # 8. Parse response for usage tracking
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

        # 9. Credit deduction + creator earnings (atomic, only on success)
        creator_credits_earned = 0
        platform_fee_credits = 0
        actual_credits_charged = 0

        if success and plan.plan_type == "credits":
            if credits_to_charge > 0 and buyer:
                actual_credits_charged = credits_to_charge
                platform_fee_credits = round(credits_to_charge * plan.platform_fee_bps / 10000)
                creator_credits_earned = credits_to_charge - platform_fee_credits

                # Deduct from buyer
                buyer.credit_balance -= actual_credits_charged
                session.add(buyer)

                # Credit creator
                creator = session.get(User, agent.owner_id)
                if creator:
                    creator.credit_balance += creator_credits_earned
                    session.add(creator)

                # Update agent total
                agent_obj = session.get(AgentProfile, agent.id)
                if agent_obj:
                    agent_obj.total_earned_credits += creator_credits_earned
                    session.add(agent_obj)

                # Update license counters
                license.credits_spent += actual_credits_charged
                license.creator_credits_earned += creator_credits_earned
                session.add(license)

            elif plan.credits_per_1k_tokens and total_tokens > 0:
                # Per-token billing
                actual_credits_charged = round(
                    (total_tokens / 1000) * plan.credits_per_1k_tokens
                )
                # Ensure buyer has balance (best-effort for per-token; was checked per-message)
                if buyer and buyer.credit_balance >= actual_credits_charged:
                    platform_fee_credits = round(
                        actual_credits_charged * plan.platform_fee_bps / 10000
                    )
                    creator_credits_earned = actual_credits_charged - platform_fee_credits

                    buyer.credit_balance -= actual_credits_charged
                    session.add(buyer)

                    creator = session.get(User, agent.owner_id)
                    if creator:
                        creator.credit_balance += creator_credits_earned
                        session.add(creator)

                    agent_obj = session.get(AgentProfile, agent.id)
                    if agent_obj:
                        agent_obj.total_earned_credits += creator_credits_earned
                        session.add(agent_obj)

                    license.credits_spent += actual_credits_charged
                    license.creator_credits_earned += creator_credits_earned
                    session.add(license)
                else:
                    actual_credits_charged = 0

        # 10. Log usage and update license counters
        cost_cents = _estimate_cost_cents(model_used, input_tokens, output_tokens)
        log = _log_usage(
            session, license, agent, model_used, input_tokens, output_tokens,
            total_tokens, cost_cents, response_time_ms, success, error_message,
            actual_credits_charged, creator_credits_earned, platform_fee_credits,
        )

        # 11. Insert CreatorEarnings row if credits were earned
        if creator_credits_earned > 0 and log is not None:
            earnings = CreatorEarnings(
                agent_profile_id=agent.id,
                owner_id=agent.owner_id,
                proxy_usage_log_id=log.id,
                gross_credits=actual_credits_charged,
                platform_fee_credits=platform_fee_credits,
                net_credits=creator_credits_earned,
            )
            session.add(earnings)
            session.commit()

        # 12. Return Anthropic's raw response
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
    credits_charged: int = 0,
    creator_credits_earned: int = 0,
    platform_fee_credits: int = 0,
) -> ProxyUsageLog | None:
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
        credits_charged=credits_charged,
        creator_credits_earned=creator_credits_earned,
        platform_fee_credits=platform_fee_credits,
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
    session.refresh(log)
    return log
