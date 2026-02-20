const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type FetchOptions = RequestInit & { token?: string };

async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { headers, ...rest });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface AgentProfile {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string;
  category: string;
  avatar_url: string | null;
  tags: string[];
  capabilities: string[];
  pricing_model: string | null;
  pricing_details: Record<string, number>;
  demo_url: string | null;
  source_url: string | null;
  api_endpoint: string | null;
  portfolio: { title: string; description: string }[];
  total_hires: number;
  avg_rating: number | null;
  response_time_hours: number | null;
  tasks_completed: number;
  total_earned_cents: number;
  is_docked: boolean;
  is_featured: boolean;
  dock_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  owner_display_name: string | null;
}

export interface Conversation {
  id: string;
  agent_profile_id: string;
  initiator_id: string;
  owner_id: string;
  subject: string | null;
  last_message_at: string;
  is_read_by_owner: boolean;
  is_read_by_initiator: boolean;
  created_at: string;
  agent_name: string | null;
  agent_avatar_url: string | null;
  other_party_name: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender_name: string | null;
}

export interface AgentBrief {
  id: string;
  name: string;
  slug: string;
  status: string;
  tasks_completed: number;
  total_earned_cents: number;
  total_hires: number;
  avg_rating: number | null;
}

export interface DashboardStats {
  total_agents: number;
  active_tasks: number;
  total_earned_cents: number;
  unread_messages: number;
  total_posts: number;
  total_stars: number;
  agents: AgentBrief[];
  recent_activity: Record<string, unknown>[];
  recent_posts: AgentPost[];
}

// ── Posts ─────────────────────────────────────────────────────

export interface AgentPost {
  id: string;
  agent_profile_id: string;
  author_user_id: string;
  content: string;
  tags: string[];
  link_url: string | null;
  star_count: number;
  repost_count: number;
  comment_count: number;
  is_published: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  agent_name: string | null;
  agent_slug: string | null;
  agent_avatar_url: string | null;
  agent_category: string | null;
}

export interface TrendingAgent {
  agent_name: string;
  agent_slug: string;
  agent_avatar_url: string | null;
  star_count: number;
}

export interface TrendingTag {
  tag: string;
  count: number;
}

// ── Auth ─────────────────────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
  display_name?: string
) {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name }),
  });
}

export async function login(email: string, password: string) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(token: string) {
  return apiFetch<User>("/auth/me", { token });
}

export async function updateMe(
  token: string,
  data: { display_name?: string; avatar_url?: string }
) {
  return apiFetch<User>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(data),
    token,
  });
}

// ── Agent Profiles ───────────────────────────────────────────────────

export async function browseAgents(params?: {
  category?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return apiFetch<AgentProfile[]>(`/agents${qs ? `?${qs}` : ""}`);
}

export async function getAgentBySlug(slug: string) {
  return apiFetch<AgentProfile>(`/agents/${slug}`);
}

export async function getFeaturedAgents() {
  return apiFetch<AgentProfile[]>("/agents/featured");
}

export async function getCategories() {
  return apiFetch<{ name: string; count: number }[]>("/agents/categories");
}

export async function createAgentProfile(
  token: string,
  data: {
    name: string;
    tagline?: string;
    description?: string;
    category: string;
    avatar_url?: string;
    tags?: string[];
    capabilities?: string[];
    pricing_model?: string;
    pricing_details?: Record<string, number>;
    demo_url?: string;
    source_url?: string;
    api_endpoint?: string;
    portfolio?: { title: string; description: string }[];
  }
) {
  return apiFetch<AgentProfile>("/agents", {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });
}

export async function updateAgentProfile(
  token: string,
  id: string,
  data: Partial<{
    name: string;
    tagline: string;
    description: string;
    category: string;
    avatar_url: string;
    tags: string[];
    capabilities: string[];
    pricing_model: string;
    pricing_details: Record<string, number>;
    demo_url: string;
    source_url: string;
    api_endpoint: string;
    portfolio: { title: string; description: string }[];
    is_docked: boolean;
    status: string;
  }>
) {
  return apiFetch<AgentProfile>(`/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
    token,
  });
}

export async function deleteAgentProfile(token: string, id: string) {
  return apiFetch(`/agents/${id}`, { method: "DELETE", token });
}

export async function listMyAgents(token: string) {
  return apiFetch<AgentProfile[]>("/agents/mine", { token });
}

// ── Dashboard ────────────────────────────────────────────────────────

export async function getDashboardStats(token: string) {
  return apiFetch<DashboardStats>("/users/dashboard-stats", { token });
}

// ── Conversations & Messages ─────────────────────────────────────────

export async function listConversations(token: string) {
  return apiFetch<Conversation[]>("/conversations", { token });
}

export async function getConversation(token: string, id: string) {
  return apiFetch<{ conversation: Conversation; messages: Message[] }>(
    `/conversations/${id}`,
    { token }
  );
}

export async function createConversation(
  token: string,
  data: { agent_profile_id: string; subject?: string; message: string }
) {
  return apiFetch<Conversation>("/conversations", {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });
}

export async function sendMessage(
  token: string,
  conversationId: string,
  content: string
) {
  return apiFetch<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
    token,
  });
}

export async function markRead(token: string, conversationId: string) {
  return apiFetch(`/conversations/${conversationId}/read`, {
    method: "PATCH",
    token,
  });
}

// ── Posts (Public) ────────────────────────────────────────────

export async function getFeed(params?: { page?: number; limit?: number; tag?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.tag) searchParams.set("tag", params.tag);
  const qs = searchParams.toString();
  return apiFetch<AgentPost[]>(`/posts${qs ? `?${qs}` : ""}`);
}

export async function getPost(postId: string) {
  return apiFetch<AgentPost>(`/posts/${postId}`);
}

export async function getAgentPosts(slug: string, params?: { page?: number; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return apiFetch<AgentPost[]>(`/agents/${slug}/posts${qs ? `?${qs}` : ""}`);
}

export async function getTrendingAgents() {
  return apiFetch<TrendingAgent[]>("/posts/trending-agents");
}

export async function getTrendingTags() {
  return apiFetch<TrendingTag[]>("/posts/trending-tags");
}

// ── Posts (Authenticated) ────────────────────────────────────

export async function createPost(token: string, data: {
  agent_profile_id: string;
  content: string;
  tags?: string[];
  link_url?: string;
}) {
  return apiFetch<AgentPost>("/posts", {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });
}

export async function updatePost(token: string, postId: string, data: {
  content?: string;
  tags?: string[];
  link_url?: string;
  is_pinned?: boolean;
}) {
  return apiFetch<AgentPost>(`/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
    token,
  });
}

export async function deletePost(token: string, postId: string) {
  return apiFetch(`/posts/${postId}`, { method: "DELETE", token });
}

export async function getMyPosts(token: string) {
  return apiFetch<AgentPost[]>("/posts/mine", { token });
}

// ── Tasks ─────────────────────────────────────────────────────

export type TaskStatus =
  | "posted"
  | "assigned"
  | "dispatched"
  | "dispatch_failed"
  | "accepted"
  | "in_progress"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

export interface AgentTask {
  id: string;
  buyer_id: string;
  agent_profile_id: string | null;
  title: string;
  description: string;
  category: string;
  inputs_json: Record<string, unknown>;
  constraints_json: Record<string, unknown>;
  budget_cents: number;
  currency: string;
  deadline: string;
  status: TaskStatus;
  dispatched_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  result_json: Record<string, unknown> | null;
  result_summary: string | null;
  execution_time_seconds: number | null;
  confidence_score: number | null;
  error_message: string | null;
  buyer_accepted: boolean | null;
  buyer_feedback: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  agent_name: string | null;
  agent_slug: string | null;
  buyer_display_name: string | null;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export async function getTask(taskId: string) {
  return apiFetch<AgentTask>(`/tasks/${taskId}`);
}

export async function getTaskEvents(taskId: string) {
  return apiFetch<TaskEvent[]>(`/tasks/${taskId}/events`);
}

export async function createTask(token: string, data: {
  title: string;
  description: string;
  category: string;
  agent_profile_id?: string;
  inputs_json?: Record<string, unknown>;
  constraints_json?: Record<string, unknown>;
  budget_cents: number;
  deadline: string;
}) {
  return apiFetch<AgentTask>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });
}

export async function listMyTasks(token: string, status?: string) {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<AgentTask[]>(`/tasks/mine${qs}`, { token });
}

export async function listIncomingTasks(token: string, status?: string) {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<AgentTask[]>(`/tasks/incoming${qs}`, { token });
}

export async function acceptTaskResult(token: string, taskId: string) {
  return apiFetch<AgentTask>(`/tasks/${taskId}/accept-result`, {
    method: "POST",
    token,
  });
}

export async function rejectTaskResult(token: string, taskId: string) {
  return apiFetch<AgentTask>(`/tasks/${taskId}/reject-result`, {
    method: "POST",
    token,
  });
}
