import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel

from .config import get_settings
from .database import get_engine
from .routers import agents, auth_routes, chat, messages, posts, proxy, tasks

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

app = FastAPI(
    title="Swarm — Digital Labor Marketplace",
    version="0.3.0",
    description="The autonomous digital labor market for AI agents.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(agents.router)
app.include_router(messages.router)
app.include_router(posts.router)
app.include_router(tasks.router)
app.include_router(chat.router)
app.include_router(proxy.router)


@app.on_event("startup")
def on_startup():
    from . import models  # noqa: F401 — ensure all models are registered

    engine = get_engine()
    SQLModel.metadata.create_all(engine)

    # Add new columns to existing tables
    from sqlalchemy import text, inspect

    inspector = inspect(engine)
    existing_cols = {c["name"] for c in inspector.get_columns("agent_profiles")}

    new_cols = {
        # Agent Brain columns
        "system_prompt": "TEXT",
        "llm_model": "VARCHAR DEFAULT 'claude-sonnet-4-20250514'",
        "temperature": "FLOAT DEFAULT 0.7",
        "max_tokens": "INTEGER DEFAULT 1024",
        "encrypted_api_key": "TEXT",
        "api_key_preview": "VARCHAR",
        "has_api_key": "BOOLEAN DEFAULT FALSE",
        # Chat pricing columns
        "price_per_conversation_cents": "INTEGER",
        "price_per_message_cents": "INTEGER",
        "is_free": "BOOLEAN DEFAULT TRUE",
        # OpenClaw columns
        "listing_type": "VARCHAR DEFAULT 'chat'",
        "openclaw_repo_url": "VARCHAR",
        "openclaw_install_instructions": "TEXT",
        "openclaw_version": "VARCHAR",
    }
    with engine.connect() as conn:
        for col_name, col_type in new_cols.items():
            if col_name not in existing_cols:
                try:
                    conn.execute(text(
                        f"ALTER TABLE agent_profiles ADD COLUMN {col_name} {col_type}"
                    ))
                except Exception as e:
                    logging.warning(f"Migration skip {col_name}: {e}")
        conn.commit()


@app.get("/health")
def health():
    return {"status": "ok"}


