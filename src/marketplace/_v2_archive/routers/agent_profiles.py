import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, func, select

from ..auth import get_current_user, get_optional_user
from ..database import get_session
from ..models import AGENT_CATEGORIES, AgentProfile, User
from ..schemas import AgentProfileCreate, AgentProfileResponse, AgentProfileUpdate
from ..slug import ensure_unique_slug, generate_slug

router = APIRouter(prefix="/agents", tags=["agents"])


def _enrich(profile: AgentProfile, session: Session) -> AgentProfileResponse:
    resp = AgentProfileResponse.model_validate(profile)
    owner = session.get(User, profile.owner_id)
    resp.owner_name = owner.display_name or owner.email if owner else None
    return resp


# ── Create ───────────────────────────────────────────────────────────


@router.post("", response_model=AgentProfileResponse, status_code=201)
def create_agent_profile(
    data: AgentProfileCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if data.category not in AGENT_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Must be one of: {AGENT_CATEGORIES}")

    base_slug = generate_slug(data.name)
    slug = ensure_unique_slug(session, base_slug)

    profile = AgentProfile(
        owner_id=user.id,
        name=data.name,
        slug=slug,
        tagline=data.tagline,
        description=data.description,
        category=data.category,
        avatar_url=data.avatar_url,
        tags=data.tags,
        capabilities=data.capabilities,
        pricing_model=data.pricing_model,
        pricing_details=data.pricing_details,
        demo_url=data.demo_url,
        source_url=data.source_url,
        api_endpoint=data.api_endpoint,
        portfolio=data.portfolio,
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return _enrich(profile, session)


# ── Browse (public) ──────────────────────────────────────────────────


@router.get("", response_model=list[AgentProfileResponse])
def browse_agents(
    category: str | None = None,
    search: str | None = None,
    sort: str = Query(default="newest", pattern="^(newest|rating|hires)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=50),
    session: Session = Depends(get_session),
):
    query = select(AgentProfile).where(AgentProfile.is_active == True)

    if category:
        query = query.where(AgentProfile.category == category)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            col(AgentProfile.name).ilike(pattern)
            | col(AgentProfile.tagline).ilike(pattern)
            | col(AgentProfile.description).ilike(pattern)
        )

    if sort == "rating":
        query = query.order_by(col(AgentProfile.avg_rating).desc())
    elif sort == "hires":
        query = query.order_by(col(AgentProfile.total_hires).desc())
    else:
        query = query.order_by(col(AgentProfile.created_at).desc())

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    profiles = session.exec(query).all()
    return [_enrich(p, session) for p in profiles]


# ── Featured (public) ────────────────────────────────────────────────


@router.get("/featured", response_model=list[AgentProfileResponse])
def get_featured_agents(session: Session = Depends(get_session)):
    profiles = session.exec(
        select(AgentProfile)
        .where(AgentProfile.is_featured == True, AgentProfile.is_active == True)
        .order_by(col(AgentProfile.avg_rating).desc())
        .limit(6)
    ).all()
    return [_enrich(p, session) for p in profiles]


# ── Categories (public) ──────────────────────────────────────────────


@router.get("/categories")
def get_categories(session: Session = Depends(get_session)):
    counts = session.exec(
        select(AgentProfile.category, func.count(AgentProfile.id))
        .where(AgentProfile.is_active == True)
        .group_by(AgentProfile.category)
    ).all()
    count_map = {cat: cnt for cat, cnt in counts}
    return [
        {"name": cat, "count": count_map.get(cat, 0)}
        for cat in AGENT_CATEGORIES
    ]


# ── My Agents (JWT) ─────────────────────────────────────────────────


@router.get("/mine", response_model=list[AgentProfileResponse])
def list_my_agents(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profiles = session.exec(
        select(AgentProfile)
        .where(AgentProfile.owner_id == user.id)
        .order_by(col(AgentProfile.created_at).desc())
    ).all()
    return [_enrich(p, session) for p in profiles]


# ── Get by slug (public) ────────────────────────────────────────────


@router.get("/{slug}", response_model=AgentProfileResponse)
def get_agent_by_slug(slug: str, session: Session = Depends(get_session)):
    profile = session.exec(
        select(AgentProfile).where(AgentProfile.slug == slug)
    ).first()
    if not profile:
        raise HTTPException(404, "Agent not found")
    return _enrich(profile, session)


# ── Update (JWT, owner) ─────────────────────────────────────────────


@router.patch("/{id}", response_model=AgentProfileResponse)
def update_agent_profile(
    id: uuid.UUID,
    data: AgentProfileUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profile = session.get(AgentProfile, id)
    if not profile or profile.owner_id != user.id:
        raise HTTPException(404, "Agent not found")

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != profile.name:
        base_slug = generate_slug(update_data["name"])
        update_data["slug"] = ensure_unique_slug(session, base_slug, exclude_id=id)

    if "category" in update_data and update_data["category"] not in AGENT_CATEGORIES:
        raise HTTPException(400, f"Invalid category. Must be one of: {AGENT_CATEGORIES}")

    for field, value in update_data.items():
        setattr(profile, field, value)

    profile.updated_at = datetime.now(UTC).replace(tzinfo=None)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return _enrich(profile, session)


# ── Delete (JWT, owner) ─────────────────────────────────────────────


@router.delete("/{id}", status_code=204)
def delete_agent_profile(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    profile = session.get(AgentProfile, id)
    if not profile or profile.owner_id != user.id:
        raise HTTPException(404, "Agent not found")

    session.delete(profile)
    session.commit()
