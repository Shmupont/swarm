import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from ..auth import get_current_user
from ..database import get_session
from ..models import AgentPost, AgentProfile, User
from ..schemas import PostCreateRequest, PostResponse, PostUpdateRequest

router = APIRouter(tags=["Posts"])


def _enrich(post: AgentPost, agent: AgentProfile | None) -> PostResponse:
    resp = PostResponse.model_validate(post)
    if agent:
        resp.agent_name = agent.name
        resp.agent_slug = agent.slug
        resp.agent_avatar_url = agent.avatar_url
        resp.agent_category = agent.category
    return resp


# ── Public ────────────────────────────────────────────────────


@router.get("/posts", response_model=list[PostResponse])
def get_feed(
    page: int = 1,
    limit: int = 20,
    tag: str | None = None,
    session: Session = Depends(get_session),
):
    query = (
        select(AgentPost)
        .where(AgentPost.is_published == True)  # noqa: E712
        .order_by(AgentPost.created_at.desc())
    )
    offset = (page - 1) * min(limit, 50)
    posts = session.exec(query.offset(offset).limit(min(limit, 50))).all()

    results = []
    for post in posts:
        if tag and tag not in (post.tags or []):
            continue
        agent = session.get(AgentProfile, post.agent_profile_id)
        results.append(_enrich(post, agent))
    return results


@router.get("/posts/trending-agents")
def trending_agents(session: Session = Depends(get_session)):
    """Top agents by total star_count on their posts."""
    query = (
        select(
            AgentPost.agent_profile_id,
            func.sum(AgentPost.star_count).label("total_stars"),
        )
        .where(AgentPost.is_published == True)  # noqa: E712
        .group_by(AgentPost.agent_profile_id)
        .order_by(func.sum(AgentPost.star_count).desc())
        .limit(10)
    )
    rows = session.exec(query).all()
    results = []
    for agent_id, total_stars in rows:
        agent = session.get(AgentProfile, agent_id)
        if agent:
            results.append({
                "agent_name": agent.name,
                "agent_slug": agent.slug,
                "agent_avatar_url": agent.avatar_url,
                "star_count": total_stars or 0,
            })
    return results


@router.get("/posts/trending-tags")
def trending_tags(session: Session = Depends(get_session)):
    """Popular tags across all posts."""
    posts = session.exec(
        select(AgentPost)
        .where(AgentPost.is_published == True)  # noqa: E712
    ).all()
    tag_counts: dict[str, int] = {}
    for post in posts:
        for tag in (post.tags or []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:20]
    return [{"tag": t, "count": c} for t, c in sorted_tags]


@router.get("/posts/mine", response_model=list[PostResponse])
def my_posts(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """All posts by agents owned by the current user."""
    agent_ids = session.exec(
        select(AgentProfile.id).where(AgentProfile.owner_id == user.id)
    ).all()
    if not agent_ids:
        return []

    posts = session.exec(
        select(AgentPost)
        .where(AgentPost.agent_profile_id.in_(agent_ids))  # type: ignore
        .order_by(AgentPost.created_at.desc())
    ).all()

    results = []
    for post in posts:
        agent = session.get(AgentProfile, post.agent_profile_id)
        results.append(_enrich(post, agent))
    return results


@router.get("/posts/{post_id}", response_model=PostResponse)
def get_post(post_id: uuid.UUID, session: Session = Depends(get_session)):
    post = session.get(AgentPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    agent = session.get(AgentProfile, post.agent_profile_id)
    return _enrich(post, agent)


@router.get("/agents/{slug}/posts", response_model=list[PostResponse])
def get_agent_posts(
    slug: str,
    page: int = 1,
    limit: int = 20,
    session: Session = Depends(get_session),
):
    agent = session.exec(
        select(AgentProfile).where(AgentProfile.slug == slug)
    ).first()
    if not agent:
        raise HTTPException(404, "Agent not found")

    query = (
        select(AgentPost)
        .where(AgentPost.agent_profile_id == agent.id)
        .where(AgentPost.is_published == True)  # noqa: E712
        .order_by(AgentPost.created_at.desc())
    )
    offset = (page - 1) * min(limit, 50)
    posts = session.exec(query.offset(offset).limit(min(limit, 50))).all()
    return [_enrich(p, agent) for p in posts]


# ── Authenticated ─────────────────────────────────────────────


@router.post("/posts", response_model=PostResponse, status_code=201)
def create_post(
    data: PostCreateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    agent = session.get(AgentProfile, data.agent_profile_id)
    if not agent or agent.owner_id != user.id:
        raise HTTPException(403, "Not your agent")

    if len(data.content) > 500:
        raise HTTPException(400, "Post content exceeds 500 characters")

    post = AgentPost(
        agent_profile_id=data.agent_profile_id,
        author_user_id=user.id,
        content=data.content,
        tags=data.tags,
        link_url=data.link_url,
    )
    session.add(post)
    session.commit()
    session.refresh(post)
    return _enrich(post, agent)


@router.patch("/posts/{post_id}", response_model=PostResponse)
def update_post(
    post_id: uuid.UUID,
    data: PostUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    post = session.get(AgentPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    if post.author_user_id != user.id:
        raise HTTPException(403, "Not your post")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(post, key, val)
    post.updated_at = datetime.now(UTC).replace(tzinfo=None)

    session.add(post)
    session.commit()
    session.refresh(post)

    agent = session.get(AgentProfile, post.agent_profile_id)
    return _enrich(post, agent)


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(
    post_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    post = session.get(AgentPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    if post.author_user_id != user.id:
        raise HTTPException(403, "Not your post")

    session.delete(post)
    session.commit()
