import secrets
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from .models import AgentLicense, AgentPricingPlan, AgentProfile


def generate_license_key() -> str:
    return f"swrm_lic_{secrets.token_urlsafe(24)}"


def create_license(
    session: Session,
    agent_profile_id,
    buyer_id,
    plan: AgentPricingPlan,
) -> AgentLicense:
    now = datetime.now(UTC).replace(tzinfo=None)

    expires_at = None
    if plan.plan_type == "rental" and plan.rental_duration_days:
        expires_at = now + timedelta(days=plan.rental_duration_days)
    elif plan.plan_type == "subscription" and plan.billing_interval:
        if plan.billing_interval == "yearly":
            expires_at = now + timedelta(days=365)
        else:
            expires_at = now + timedelta(days=30)

    license = AgentLicense(
        agent_profile_id=agent_profile_id,
        buyer_id=buyer_id,
        pricing_plan_id=plan.id,
        license_key=generate_license_key(),
        status="active",
        activated_at=now,
        expires_at=expires_at,
        period_start=now,
    )
    session.add(license)
    session.commit()
    session.refresh(license)
    return license


def validate_license(session: Session, license_key: str) -> dict:
    license = session.exec(
        select(AgentLicense).where(AgentLicense.license_key == license_key)
    ).first()
    if not license:
        raise ValueError("Invalid license key")

    if license.status != "active":
        raise ValueError(f"License is {license.status}")

    now = datetime.now(UTC).replace(tzinfo=None)
    if license.expires_at and now > license.expires_at:
        license.status = "expired"
        session.add(license)
        session.commit()
        raise ValueError("License has expired")

    plan = session.get(AgentPricingPlan, license.pricing_plan_id)
    if not plan:
        raise ValueError("License plan not found")

    # Check usage limits
    if plan.max_messages_per_period and license.period_messages >= plan.max_messages_per_period:
        raise ValueError("Message limit reached for this billing period")
    if plan.max_tokens_per_period and license.period_tokens >= plan.max_tokens_per_period:
        raise ValueError("Token limit reached for this billing period")

    agent = session.get(AgentProfile, license.agent_profile_id)
    if not agent:
        raise ValueError("Agent not found")

    return {"license": license, "agent": agent, "plan": plan}
