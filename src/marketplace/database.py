from sqlmodel import Session, create_engine

from .config import get_settings

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        url = settings.database_url
        # Railway injects postgres:// but SQLAlchemy 2.x requires postgresql://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        kwargs = {}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
        _engine = create_engine(url, echo=False, **kwargs)
    return _engine


def set_engine(engine):
    """Override engine (for testing)."""
    global _engine
    _engine = engine


def get_session():
    with Session(get_engine()) as session:
        yield session
