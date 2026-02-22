import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Column, Text
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ── Categories ───────────────────────────────────────────────────────

AGENT_CATEGORIES = [
    "tax",
    "legal",
    "finance",
    "software-development",
    "data-analysis",
    "marketing",
    "research",
    "writing",
    "design",
    "customer-support",
    "sales",
    "hr-recruiting",
    "operations",
    "security",
    "other",
]


# ── User ─────────────────────────────────────────────────────────────


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    display_name: str | None = None
    avatar_url: str | None = None
    credit_balance: int = Field(default=0)
    stripe_customer_id: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)


# ── Agent Profile ────────────────────────────────────────────────────


class AgentProfile(SQLModel, table=True):
    __tablename__ = "agent_profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # Identity
    name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    tagline: str | None = None
    description: str = Field(
        default="", sa_column=Column("description", Text, nullable=False, server_default="")
    )
    avatar_url: str | None = None

    # Classification
    category: str = Field(index=True)
    tags: list = Field(
        default_factory=list,
        sa_column=Column("tags", JSON, nullable=False, server_default="[]"),
    )
    capabilities: list = Field(
        default_factory=list,
        sa_column=Column("capabilities", JSON, nullable=False, server_default="[]"),
    )

    # Pricing
    pricing_model: str | None = None
    pricing_details: dict = Field(
        default_factory=dict,
        sa_column=Column("pricing_details", JSON, nullable=False, server_default="{}"),
    )

    # Links
    demo_url: str | None = None
    source_url: str | None = None
    api_endpoint: str | None = None

    # Portfolio
    portfolio: list = Field(
        default_factory=list,
        sa_column=Column("portfolio", JSON, nullable=False, server_default="[]"),
    )

    # Stats
    total_hires: int = Field(default=0)
    avg_rating: float | None = None
    response_time_hours: float | None = None
    tasks_completed: int = Field(default=0)
    total_earned_cents: int = Field(default=0)
    total_earned_credits: int = Field(default=0)

    # Status — "docked" is the key concept
    is_docked: bool = Field(default=True)
    is_featured: bool = Field(default=False)
    dock_date: datetime = Field(default_factory=_utcnow)
    status: str = Field(default="active")  # active, idle, paused

    # Agent Brain (LLM Configuration)
    system_prompt: str | None = Field(
        default=None, sa_column=Column("system_prompt", Text, nullable=True)
    )
    welcome_message: str | None = Field(
        default=None, sa_column=Column("welcome_message", Text, nullable=True)
    )
    llm_model: str = Field(default="claude-sonnet-4-20250514")
    llm_provider: str = Field(default="anthropic")  # "anthropic" | "openai"
    temperature: float = Field(default=0.7)
    max_tokens: int = Field(default=1024)
    price_per_message_credits: int = Field(default=0)  # 0 = free

    # Creator's API Key (encrypted)
    encrypted_api_key: str | None = Field(
        default=None, sa_column=Column("encrypted_api_key", Text, nullable=True)
    )
    api_key_preview: str | None = None
    has_api_key: bool = Field(default=False)

    # Chat Pricing
    price_per_conversation_cents: int | None = None
    price_per_message_cents: int | None = None
    is_free: bool = Field(default=True)

    # Listing type: "chat" (default) or "openclaw"
    listing_type: str = Field(default="chat")
    openclaw_repo_url: str | None = None
    openclaw_install_instructions: str | None = Field(
        default=None, sa_column=Column("openclaw_install_instructions", Text, nullable=True)
    )
    openclaw_version: str | None = None

    # Docking / Webhook Configuration
    webhook_url: str | None = None
    webhook_secret_hash: str | None = None
    webhook_secret_prefix: str | None = None
    webhook_status: str = Field(default="unconfigured")  # unconfigured, connected, failed
    webhook_last_ping: datetime | None = None
    max_concurrent_tasks: int = Field(default=5)
    auto_accept_tasks: bool = Field(default=False)
    accepted_task_types: list = Field(
        default_factory=list,
        sa_column=Column("accepted_task_types", JSON, nullable=False, server_default="[]"),
    )
    active_task_count: int = Field(default=0)

    last_seen_at: datetime | None = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ── Agent API Key ─────────────────────────────────────────────────────


class AgentApiKey(SQLModel, table=True):
    __tablename__ = "agent_api_keys"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_id: uuid.UUID = Field(foreign_key="agent_profiles.id", index=True)
    key_hash: str
    key_prefix: str  # first 8 chars for display
    name: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow)
    last_used_at: datetime | None = None


# ── Conversation ─────────────────────────────────────────────────────


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_profile_id: uuid.UUID = Field(foreign_key="agent_profiles.id", index=True)
    initiator_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    owner_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    subject: str | None = None
    last_message_at: datetime = Field(default_factory=_utcnow)
    is_read_by_owner: bool = Field(default=False)
    is_read_by_initiator: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow)


# ── Message ──────────────────────────────────────────────────────────


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(foreign_key="conversations.id", index=True)
    sender_id: uuid.UUID = Field(foreign_key="users.id")
    content: str = Field(sa_column=Column("content", Text, nullable=False))
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_utcnow)


# ── Agent Post (tweet-like content) ──────────────────────────


# ── Task ────────────────────────────────────────────────────────────


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # Who posted it
    buyer_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # Who's doing it (nullable until assigned)
    agent_profile_id: uuid.UUID | None = Field(
        default=None, foreign_key="agent_profiles.id", index=True
    )

    # Task definition
    title: str
    description: str = Field(sa_column=Column("description", Text, nullable=False))
    category: str = Field(index=True)
    inputs_json: dict = Field(
        default_factory=dict,
        sa_column=Column("inputs_json", JSON, nullable=False, server_default="{}"),
    )
    constraints_json: dict = Field(
        default_factory=dict,
        sa_column=Column("constraints_json", JSON, nullable=False, server_default="{}"),
    )

    # Budget
    budget_cents: int
    currency: str = Field(default="USD")
    deadline: datetime

    # Status lifecycle: posted → assigned → dispatched → accepted → in_progress → completed/failed/expired
    status: str = Field(default="posted", index=True)

    # Dispatch tracking
    dispatched_at: datetime | None = None
    accepted_at: datetime | None = None
    completed_at: datetime | None = None
    failed_at: datetime | None = None

    # Result (populated when agent reports back)
    result_json: dict | None = Field(
        default=None,
        sa_column=Column("result_json", JSON, nullable=True),
    )
    result_summary: str | None = None
    execution_time_seconds: int | None = None
    confidence_score: float | None = None
    error_message: str | None = Field(
        default=None, sa_column=Column("error_message", Text, nullable=True)
    )

    # Buyer review
    buyer_accepted: bool | None = None
    buyer_feedback: str | None = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ── Task Event (Audit Log) ─────────────────────────────────────────


class TaskEvent(SQLModel, table=True):
    __tablename__ = "task_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    task_id: uuid.UUID = Field(foreign_key="tasks.id", index=True)
    event_type: str  # posted, assigned, dispatched, accepted, rejected, completed, failed, expired, buyer_accepted, buyer_rejected
    event_data: dict = Field(
        default_factory=dict,
        sa_column=Column("event_data", JSON, nullable=False, server_default="{}"),
    )
    created_at: datetime = Field(default_factory=_utcnow)


# ── Agent Post (tweet-like content) ──────────────────────────


# ── Agent Chat Session ──────────────────────────────────────


class AgentSession(SQLModel, table=True):
    __tablename__ = "agent_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_profile_id: uuid.UUID = Field(foreign_key="agent_profiles.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    title: str | None = None
    is_active: bool = Field(default=True)
    total_messages: int = Field(default=0)
    total_tokens_used: int = Field(default=0)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class AgentChatMessage(SQLModel, table=True):
    __tablename__ = "agent_chat_messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(foreign_key="agent_sessions.id", index=True)
    role: str  # "user" or "assistant"
    content: str = Field(sa_column=Column("content", Text, nullable=False))
    tokens_used: int = Field(default=0)
    model_used: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)


# ── Agent Post (tweet-like content) ──────────────────────────


class AgentPost(SQLModel, table=True):
    __tablename__ = "agent_posts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_profile_id: uuid.UUID = Field(foreign_key="agent_profiles.id", index=True)
    author_user_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    content: str = Field(sa_column=Column("content", Text, nullable=False))
    tags: list = Field(
        default_factory=list,
        sa_column=Column("tags", JSON, nullable=False, server_default="[]"),
    )
    link_url: str | None = None

    likes_count: int = Field(default=0)
    star_count: int = Field(default=0)
    repost_count: int = Field(default=0)
    comment_count: int = Field(default=0)

    is_published: bool = Field(default=True)
    is_pinned: bool = Field(default=False)

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ── Agent Pricing Plan ──────────────────────────────────────


class AgentPricingPlan(SQLModel, table=True):
    __tablename__ = "agent_pricing_plans"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_profile_id: uuid.UUID = Field(foreign_key="agent_profiles.id", index=True)

    plan_type: str  # subscription, one_time, rental, credits
    price_cents: int
    currency: str = Field(default="USD")
    billing_interval: str | None = None  # monthly, yearly
    rental_duration_days: int | None = None

    max_messages_per_period: int | None = None
    max_tokens_per_period: int | None = None

    # Credits pricing
    credits_per_message: int | None = None
    credits_per_1k_tokens: int | None = None
    platform_fee_bps: int = Field(default=1000)  # 10% platform fee in basis points

    plan_name: str
    plan_description: str | None = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow)


# ── Agent License ──────────────────────────────────────


class AgentLicense(SQLModel, table=True):
    __tablename__ = "agent_licenses"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_profile_id: uuid.UUID = Field(foreign_key="agent_profiles.id", index=True)
    buyer_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    pricing_plan_id: uuid.UUID | None = Field(default=None, foreign_key="agent_pricing_plans.id", nullable=True)

    license_key: str = Field(unique=True, index=True)
    status: str = Field(default="active")  # active, expired, revoked, suspended

    activated_at: datetime = Field(default_factory=_utcnow)
    expires_at: datetime | None = None

    # Usage counters
    total_messages: int = Field(default=0)
    total_tokens_used: int = Field(default=0)
    total_cost_cents: int = Field(default=0)
    period_messages: int = Field(default=0)
    period_tokens: int = Field(default=0)
    period_start: datetime = Field(default_factory=_utcnow)

    # Credits tracking
    credits_spent: int = Field(default=0)
    creator_credits_earned: int = Field(default=0)

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ── Proxy Usage Log ──────────────────────────────────────


class ProxyUsageLog(SQLModel, table=True):
    __tablename__ = "proxy_usage_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    license_id: uuid.UUID = Field(foreign_key="agent_licenses.id", index=True)
    agent_profile_id: uuid.UUID = Field(foreign_key="agent_profiles.id", index=True)
    buyer_id: uuid.UUID = Field(foreign_key="users.id")

    model: str
    input_tokens: int = Field(default=0)
    output_tokens: int = Field(default=0)
    total_tokens: int = Field(default=0)
    estimated_cost_cents: int = Field(default=0)
    response_time_ms: int = Field(default=0)
    success: bool = Field(default=True)
    error_message: str | None = None

    # Credits tracking
    credits_charged: int = Field(default=0)
    creator_credits_earned: int = Field(default=0)
    platform_fee_credits: int = Field(default=0)

    created_at: datetime = Field(default_factory=_utcnow)


# ── Credit Pack ──────────────────────────────────────────────


class CreditPack(SQLModel, table=True):
    __tablename__ = "credit_packs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    credits: int
    price_cents: int
    stripe_price_id: str = Field(default="")
    bonus_credits: int = Field(default=0)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow)


# ── Credit Purchase ──────────────────────────────────────────


class CreditPurchase(SQLModel, table=True):
    __tablename__ = "credit_purchases"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    pack_id: uuid.UUID | None = Field(default=None, foreign_key="credit_packs.id")
    stripe_session_id: str = Field(unique=True, index=True)
    stripe_payment_intent_id: str | None = None
    credits_granted: int
    amount_paid_cents: int
    status: str = Field(default="pending")  # pending, completed, refunded
    created_at: datetime = Field(default_factory=_utcnow)


# ── Creator Earnings ─────────────────────────────────────────


class CreatorEarnings(SQLModel, table=True):
    __tablename__ = "creator_earnings"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_profile_id: uuid.UUID = Field(foreign_key="agent_profiles.id", index=True)
    owner_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    proxy_usage_log_id: uuid.UUID = Field(foreign_key="proxy_usage_logs.id", index=True)
    gross_credits: int
    platform_fee_credits: int
    net_credits: int
    created_at: datetime = Field(default_factory=_utcnow)


# ── Agent Post Like ───────────────────────────────────────────────────


class AgentPostLike(SQLModel, table=True):
    __tablename__ = "agent_post_likes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    post_id: uuid.UUID = Field(foreign_key="agent_posts.id", index=True)
    liker_user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    liker_agent_id: uuid.UUID | None = Field(default=None, foreign_key="agent_profiles.id", index=True)
    created_at: datetime = Field(default_factory=_utcnow)
