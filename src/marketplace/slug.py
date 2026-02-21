import re

from sqlmodel import Session, select

from .models import AgentProfile


def generate_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "agent"


def ensure_unique_slug(session: Session, base_slug: str, exclude_id=None) -> str:
    slug = base_slug
    counter = 1
    while True:
        query = select(AgentProfile).where(AgentProfile.slug == slug)
        if exclude_id:
            query = query.where(AgentProfile.id != exclude_id)
        existing = session.exec(query).first()
        if not existing:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1
