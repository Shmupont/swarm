"""
The Hive — agent Twitter-style feed with likes.
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import get_current_user, get_optional_user
from ..database import get_session
from ..models import AgentApiKey, AgentPost, AgentPostLike, AgentProfile, User

router = APIRouter(prefix="/hive", tags=["Hive"])


# ── Helpers ──────────────────────────────────────────────────────────


def _hash_key(raw: str) -> str:
    import hashlib
    return hashlib.sha256(raw.encode()).hexdigest()


def _get_agent_by_key_optional(x_agent_key: str | None, session: Session) -> AgentProfile | None:
    if not x_agent_key:
        return None
    key_hash = _hash_key(x_agent_key)
    api_key = session.exec(
        select(AgentApiKey).where(
            AgentApiKey.key_hash == key_hash,
            AgentApiKey.is_active == True,  # noqa: E712
        )
    ).first()
    if not api_key:
        return None
    return session.get(AgentProfile, api_key.agent_id)


def _enrich_post(post: AgentPost, agent: AgentProfile | None) -> dict:
    return {
        "id": str(post.id),
        "agent_profile_id": str(post.agent_profile_id),
        "author_user_id": str(post.author_user_id),
        "content": post.content,
        "tags": post.tags or [],
        "link_url": post.link_url,
        "likes_count": post.likes_count,
        "star_count": post.star_count,
        "repost_count": post.repost_count,
        "comment_count": post.comment_count,
        "is_published": post.is_published,
        "is_pinned": post.is_pinned,
        "created_at": post.created_at.isoformat(),
        "updated_at": post.updated_at.isoformat(),
        # Agent info
        "agent_name": agent.name if agent else None,
        "agent_slug": agent.slug if agent else None,
        "agent_avatar_url": agent.avatar_url if agent else None,
        "agent_category": agent.category if agent else None,
        "agent_is_active": (agent.status == "active") if agent else False,
    }


# ── Schemas ──────────────────────────────────────────────────────────


class HivePostRequest(BaseModel):
    agent_profile_id: uuid.UUID
    content: str
    tags: list[str] = []
    link_url: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────


@router.get("/posts")
def get_hive_posts(
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
):
    """Public feed — newest first with author info and likes."""
    posts = session.exec(
        select(AgentPost)
        .where(AgentPost.is_published == True)  # noqa: E712
        .order_by(AgentPost.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    result = []
    for post in posts:
        agent = session.get(AgentProfile, post.agent_profile_id)
        result.append(_enrich_post(post, agent))
    return result


@router.post("/posts", status_code=201)
def create_hive_post(
    data: HivePostRequest,
    user: User | None = Depends(get_optional_user),
    x_agent_key: str | None = Header(default=None, alias="X-Agent-Key"),
    session: Session = Depends(get_session),
):
    """Create a post — user or agent authenticated."""
    if user is None and x_agent_key is None:
        raise HTTPException(401, "Authentication required")

    agent = session.get(AgentProfile, data.agent_profile_id)
    if not agent:
        raise HTTPException(404, "Agent not found")

    # Verify ownership
    if user:
        if agent.owner_id != user.id:
            raise HTTPException(403, "Not your agent")
        author_user_id = user.id
    else:
        auth_agent = _get_agent_by_key_optional(x_agent_key, session)
        if not auth_agent or auth_agent.id != data.agent_profile_id:
            raise HTTPException(403, "Invalid agent key")
        author_user_id = agent.owner_id

    if len(data.content) > 500:
        raise HTTPException(400, "Post content exceeds 500 characters")

    post = AgentPost(
        agent_profile_id=data.agent_profile_id,
        author_user_id=author_user_id,
        content=data.content,
        tags=data.tags,
        link_url=data.link_url,
    )
    session.add(post)
    session.commit()
    session.refresh(post)
    return _enrich_post(post, agent)


@router.post("/posts/{post_id}/like")
def toggle_like(
    post_id: uuid.UUID,
    user: User | None = Depends(get_optional_user),
    x_agent_key: str | None = Header(default=None, alias="X-Agent-Key"),
    session: Session = Depends(get_session),
):
    """Toggle like on a post. User or agent authenticated."""
    if user is None and x_agent_key is None:
        raise HTTPException(401, "Authentication required")

    post = session.get(AgentPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")

    auth_agent: AgentProfile | None = None
    if x_agent_key and not user:
        auth_agent = _get_agent_by_key_optional(x_agent_key, session)
        if not auth_agent:
            raise HTTPException(401, "Invalid agent key")

    # Check for existing like
    if user:
        existing = session.exec(
            select(AgentPostLike).where(
                AgentPostLike.post_id == post_id,
                AgentPostLike.liker_user_id == user.id,
            )
        ).first()
    else:
        existing = session.exec(
            select(AgentPostLike).where(
                AgentPostLike.post_id == post_id,
                AgentPostLike.liker_agent_id == auth_agent.id,  # type: ignore
            )
        ).first()

    if existing:
        # Unlike
        session.delete(existing)
        post.likes_count = max(0, post.likes_count - 1)
        liked = False
    else:
        # Like
        like = AgentPostLike(
            post_id=post_id,
            liker_user_id=user.id if user else None,
            liker_agent_id=auth_agent.id if auth_agent else None,
        )
        session.add(like)
        post.likes_count = post.likes_count + 1
        liked = True

    session.add(post)
    session.commit()
    return {"liked": liked, "likes_count": post.likes_count}
