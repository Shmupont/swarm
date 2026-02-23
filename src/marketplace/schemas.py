import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Auth / User ──────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    user_type: str | None = None
    onboarding_completed: bool = False


class AuthResponse(BaseModel):
    access_token: str
    user: UserResponse


class UserUpdate(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None


class UserTypeUpdate(BaseModel):
    user_type: str | None = None  # 'creator' | 'user' | null


# ── Agent Profile ────────────────────────────────────────────────────


class AgentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    tagline: str | None = None
    description: str = ""
    avatar_url: str | None = None
    category: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    pricing_model: str | None = None
    pricing_details: dict = Field(default_factory=dict)
    demo_url: str | None = None
    source_url: str | None = None
    api_endpoint: str | None = None
    portfolio: list[dict] = Field(default_factory=list)
    listing_type: str = "chat"
    openclaw_repo_url: str | None = None
    openclaw_install_instructions: str | None = None
    openclaw_version: str | None = None
    price_usd: float | None = None  # if set, convert to credits (1 USD = 100 credits)


class AgentUpdateRequest(BaseModel):
    name: str | None = None
    tagline: str | None = None
    description: str | None = None
    avatar_url: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    capabilities: list[str] | None = None
    pricing_model: str | None = None
    pricing_details: dict | None = None
    demo_url: str | None = None
    source_url: str | None = None
    api_endpoint: str | None = None
    portfolio: list[dict] | None = None
    is_docked: bool | None = None
    status: str | None = None
    listing_type: str | None = None
    openclaw_repo_url: str | None = None
    openclaw_install_instructions: str | None = None
    openclaw_version: str | None = None


class AgentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    slug: str
    tagline: str | None
    description: str
    avatar_url: str | None = None
    category: str
    tags: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)
    pricing_model: str | None = None
    pricing_details: dict = Field(default_factory=dict)
    demo_url: str | None = None
    source_url: str | None = None
    api_endpoint: str | None = None
    portfolio: list[dict] = Field(default_factory=list)
    total_hires: int = 0
    avg_rating: float | None = None
    response_time_hours: float | None = None
    tasks_completed: int = 0
    total_earned_cents: int = 0
    is_docked: bool = True
    is_featured: bool = False
    dock_date: datetime
    status: str = "active"
    created_at: datetime
    updated_at: datetime

    # Chat readiness
    is_chat_ready: bool = False
    is_free: bool = True
    price_per_conversation_cents: int | None = None
    price_per_message_cents: int | None = None
    price_per_message_credits: int = 0
    welcome_message: str | None = None
    llm_provider: str = "anthropic"

    # OpenClaw fields
    listing_type: str = "chat"
    openclaw_repo_url: str | None = None
    openclaw_install_instructions: str | None = None
    openclaw_version: str | None = None

    # Joined fields (for browse)
    owner_display_name: str | None = None


# ── Conversation ─────────────────────────────────────────────────────


class StartConversationRequest(BaseModel):
    agent_profile_id: uuid.UUID
    subject: str | None = None
    message: str = Field(min_length=1)


class ConversationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    agent_profile_id: uuid.UUID
    initiator_id: uuid.UUID
    owner_id: uuid.UUID
    subject: str | None
    last_message_at: datetime
    is_read_by_owner: bool = False
    is_read_by_initiator: bool = True
    created_at: datetime

    # Joined fields
    agent_name: str | None = None
    agent_avatar_url: str | None = None
    other_party_name: str | None = None
    last_message_preview: str | None = None
    unread_count: int = 0


# ── Message ──────────────────────────────────────────────────────────


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1)


class MessageResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    is_read: bool
    created_at: datetime

    # Joined fields
    sender_name: str | None = None


# ── Dashboard ────────────────────────────────────────────────────────


class AgentBriefResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    status: str
    tasks_completed: int = 0
    total_earned_cents: int = 0
    total_hires: int = 0
    avg_rating: float | None = None


class DashboardStatsResponse(BaseModel):
    total_agents: int
    active_tasks: int = 0
    total_earned_cents: int
    unread_messages: int
    total_posts: int = 0
    total_stars: int = 0
    agents: list[AgentBriefResponse]
    recent_activity: list[dict] = Field(default_factory=list)
    recent_posts: list["PostResponse"] = Field(default_factory=list)


# ── Webhook ──────────────────────────────────────────────────


class WebhookConfigRequest(BaseModel):
    webhook_url: str
    max_concurrent_tasks: int = 5
    auto_accept_tasks: bool = False
    accepted_task_types: list[str] = Field(default_factory=list)


class WebhookConfigResponse(BaseModel):
    webhook_url: str
    webhook_secret: str | None = None  # only returned on first config or regenerate
    webhook_secret_prefix: str | None
    webhook_status: str
    webhook_last_ping: datetime | None
    max_concurrent_tasks: int
    auto_accept_tasks: bool
    accepted_task_types: list[str]


# ── Tasks ────────────────────────────────────────────────────


class TaskCreateRequest(BaseModel):
    agent_profile_id: uuid.UUID | None = None  # specific agent, or null for open
    title: str
    description: str
    category: str
    inputs_json: dict = Field(default_factory=dict)
    constraints_json: dict = Field(default_factory=dict)
    budget_cents: int
    deadline: datetime


class TaskResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    buyer_id: uuid.UUID
    agent_profile_id: uuid.UUID | None
    title: str
    description: str
    category: str
    inputs_json: dict
    constraints_json: dict
    budget_cents: int
    currency: str
    deadline: datetime
    status: str
    dispatched_at: datetime | None
    accepted_at: datetime | None
    completed_at: datetime | None
    failed_at: datetime | None
    result_json: dict | None
    result_summary: str | None
    execution_time_seconds: int | None
    confidence_score: float | None
    error_message: str | None
    buyer_accepted: bool | None
    buyer_feedback: str | None
    created_at: datetime
    updated_at: datetime

    # Joined fields
    agent_name: str | None = None
    agent_slug: str | None = None
    buyer_display_name: str | None = None


class TaskEventResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    task_id: uuid.UUID
    event_type: str
    event_data: dict
    created_at: datetime


class TaskResultCallback(BaseModel):
    task_id: uuid.UUID
    status: str  # completed, failed, partial
    result: dict | None = None
    error: str | None = None


# ── Posts ─────────────────────────────────────────────────────


class PostCreateRequest(BaseModel):
    agent_profile_id: uuid.UUID
    content: str = Field(max_length=500)
    tags: list[str] = Field(default_factory=list)
    link_url: str | None = None


class PostUpdateRequest(BaseModel):
    content: str | None = None
    tags: list[str] | None = None
    link_url: str | None = None
    is_pinned: bool | None = None


class PostResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    agent_profile_id: uuid.UUID
    author_user_id: uuid.UUID
    content: str
    tags: list[str] = Field(default_factory=list)
    link_url: str | None = None
    star_count: int = 0
    repost_count: int = 0
    comment_count: int = 0
    is_published: bool = True
    is_pinned: bool = False
    created_at: datetime
    updated_at: datetime

    agent_name: str | None = None
    agent_slug: str | None = None
    agent_avatar_url: str | None = None
    agent_category: str | None = None


# ── Agent Brain Config ───────────────────────────────────────


class AgentBrainConfigRequest(BaseModel):
    system_prompt: str
    llm_model: str = "claude-sonnet-4-20250514"
    temperature: float = 0.7
    max_tokens: int = 1024


class AgentApiKeyRequest(BaseModel):
    api_key: str


class AgentPricingRequest(BaseModel):
    price_per_conversation_cents: int | None = None
    price_per_message_cents: int | None = None
    is_free: bool = True


# ── Agent AI Config (combined) ────────────────────────────────


class AgentConfigUpdateRequest(BaseModel):
    system_prompt: str | None = None
    welcome_message: str | None = None
    llm_model: str | None = None
    llm_provider: str | None = None
    price_per_message_credits: int | None = None
    api_key: str | None = None  # if provided, encrypt and store
    openai_assistant_id: str | None = None


class AgentConfigResponse(BaseModel):
    system_prompt: str | None = None
    welcome_message: str | None = None
    llm_model: str = "claude-sonnet-4-20250514"
    llm_provider: str = "anthropic"
    price_per_message_credits: int = 0
    has_api_key: bool = False
    api_key_preview: str | None = None
    openai_assistant_id: str | None = None


# ── Hire Flow ─────────────────────────────────────────────────


class HireResponse(BaseModel):
    license_id: uuid.UUID
    agent_id: uuid.UUID
    agent_slug: str
    price_per_message: int
    welcome_message: str | None = None


# ── Chat Sessions ────────────────────────────────────────────


class SessionResponse(BaseModel):
    id: uuid.UUID
    agent_profile_id: uuid.UUID
    user_id: uuid.UUID
    title: str | None
    is_active: bool
    total_messages: int
    created_at: str
    updated_at: str
    agent_name: str | None = None
    agent_slug: str | None = None
    agent_avatar_url: str | None = None


class ChatSendMessageRequest(BaseModel):
    content: str = Field(min_length=1)


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    tokens_used: int
    model_used: str | None
    created_at: str


class ChatResponse(BaseModel):
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
    credit_balance: int | None = None  # user's balance after deduction


# ── Pricing Plans & Licenses ─────────────────────────────────


class PricingPlanCreateRequest(BaseModel):
    plan_name: str = Field(min_length=1, max_length=200)
    plan_description: str | None = None
    plan_type: str = Field(pattern="^(subscription|one_time|rental)$")
    price_cents: int = Field(ge=0)
    currency: str = "USD"
    billing_interval: str | None = None  # monthly, yearly
    rental_duration_days: int | None = None
    max_messages_per_period: int | None = None
    max_tokens_per_period: int | None = None


class PricingPlanResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    agent_profile_id: uuid.UUID
    plan_name: str
    plan_description: str | None
    plan_type: str
    price_cents: int
    currency: str
    billing_interval: str | None
    rental_duration_days: int | None
    max_messages_per_period: int | None
    max_tokens_per_period: int | None
    is_active: bool
    created_at: datetime


class PurchaseRequest(BaseModel):
    pricing_plan_id: uuid.UUID


class PurchaseResponse(BaseModel):
    license_id: uuid.UUID
    license_key: str
    status: str
    expires_at: datetime | None
    proxy_url: str
    setup_instructions: str
    plan: PricingPlanResponse


class LicenseResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    agent_profile_id: uuid.UUID
    buyer_id: uuid.UUID
    pricing_plan_id: uuid.UUID
    license_key: str
    status: str
    activated_at: datetime
    expires_at: datetime | None
    total_messages: int
    total_tokens_used: int
    total_cost_cents: int
    period_messages: int
    period_tokens: int
    period_start: datetime
    created_at: datetime
    updated_at: datetime

    # Joined
    agent_name: str | None = None
    agent_slug: str | None = None
    plan_name: str | None = None
    plan_type: str | None = None
    max_messages_per_period: int | None = None
    max_tokens_per_period: int | None = None


class UsageLogResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost_cents: int
    response_time_ms: int
    success: bool
    error_message: str | None
    created_at: datetime


class UsageStatsResponse(BaseModel):
    license: LicenseResponse
    recent_usage: list[UsageLogResponse] = []


# ── Trial ─────────────────────────────────────────────────────

class TrialSendRequest(BaseModel):
    message: str = Field(min_length=1)


class TrialResponse(BaseModel):
    response: str
    messages_used: int
    max_messages: int
    messages_remaining: int


class TrialStatusResponse(BaseModel):
    has_trial: bool
    messages_used: int
    max_messages: int
    exhausted: bool


# ── Assistant ──────────────────────────────────────────────────

class AssistantMessage(BaseModel):
    role: str
    content: str


class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[AssistantMessage] = Field(default_factory=list)


class AssistantChatResponse(BaseModel):
    response: str
