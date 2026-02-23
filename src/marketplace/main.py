import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel

from .config import get_settings
from .database import get_engine
from .routers import agents, auth_routes, chat, messages, payments, posts, proxy, tasks
from .routers import selfdock, hive, a2a, mission_control, connect, assistant

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
app.include_router(payments.router)
app.include_router(selfdock.router)
app.include_router(hive.router)
app.include_router(a2a.router)
app.include_router(mission_control.router)
app.include_router(connect.router)
app.include_router(assistant.router)


@app.on_event("startup")
def on_startup():
    from . import models  # noqa: F401 — ensure all models are registered

    engine = get_engine()
    SQLModel.metadata.create_all(engine)

    # Add new columns to existing tables
    from sqlalchemy import inspect, text

    def _migrate_table(table: str, new_cols: dict):
        inspector = inspect(engine)
        existing = {c["name"] for c in inspector.get_columns(table)}
        with engine.connect() as conn:
            for col_name, col_type in new_cols.items():
                if col_name not in existing:
                    try:
                        conn.execute(text(
                            f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"
                        ))
                    except Exception as e:
                        logging.warning(f"Migration skip {table}.{col_name}: {e}")
            conn.commit()

    _migrate_table("agent_profiles", {
        "system_prompt": "TEXT",
        "welcome_message": "TEXT",
        "llm_model": "VARCHAR DEFAULT 'claude-sonnet-4-20250514'",
        "llm_provider": "VARCHAR DEFAULT 'anthropic'",
        "temperature": "FLOAT DEFAULT 0.7",
        "max_tokens": "INTEGER DEFAULT 1024",
        "price_per_message_credits": "INTEGER DEFAULT 0",
        "encrypted_api_key": "TEXT",
        "api_key_preview": "VARCHAR",
        "has_api_key": "BOOLEAN DEFAULT FALSE",
        "price_per_conversation_cents": "INTEGER",
        "price_per_message_cents": "INTEGER",
        "is_free": "BOOLEAN DEFAULT TRUE",
        "listing_type": "VARCHAR DEFAULT 'chat'",
        "openclaw_repo_url": "VARCHAR",
        "openclaw_install_instructions": "TEXT",
        "openclaw_version": "VARCHAR",
        "total_earned_credits": "INTEGER DEFAULT 0",
    })

    _migrate_table("users", {
        "credit_balance": "INTEGER DEFAULT 0",
        "stripe_customer_id": "VARCHAR",
    })

    _migrate_table("agent_pricing_plans", {
        "credits_per_message": "INTEGER",
        "credits_per_1k_tokens": "INTEGER",
        "platform_fee_bps": "INTEGER DEFAULT 2000",
    })

    _migrate_table("agent_licenses", {
        "credits_spent": "INTEGER DEFAULT 0",
        "creator_credits_earned": "INTEGER DEFAULT 0",
    })

    # Make pricing_plan_id nullable in agent_licenses (for chat-agent hire flow)
    try:
        with engine.connect() as conn:
            # PostgreSQL
            conn.execute(text(
                "ALTER TABLE agent_licenses ALTER COLUMN pricing_plan_id DROP NOT NULL"
            ))
            conn.commit()
    except Exception:
        pass  # Already nullable or SQLite (no-op for SQLite)

    _migrate_table("proxy_usage_logs", {
        "credits_charged": "INTEGER DEFAULT 0",
        "creator_credits_earned": "INTEGER DEFAULT 0",
        "platform_fee_credits": "INTEGER DEFAULT 0",
    })

    _migrate_table("agent_profiles", {
        "last_seen_at": "TIMESTAMP",
    })

    _migrate_table("agent_posts", {
        "likes_count": "INTEGER DEFAULT 0",
    })

    _migrate_table("users", {
        "stripe_connect_account_id": "VARCHAR",
    })

    _migrate_table("users", {
        "user_type": "VARCHAR(20)",
        "onboarding_completed": "BOOLEAN NOT NULL DEFAULT FALSE",
    })

    # Create trial_sessions table if not exists
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS trial_sessions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
                    messages_used INTEGER NOT NULL DEFAULT 0,
                    max_messages INTEGER NOT NULL DEFAULT 3,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (user_id, agent_id)
                )
            """))
            conn.commit()
    except Exception:
        # SQLite or table already exists
        pass


@app.get("/health")
def health():
    return {"status": "ok"}
