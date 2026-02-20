/**
 * Task-related types and API functions.
 * Separate from api.ts (owned by Terminal 4).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function taskFetch<T = unknown>(
  path: string,
  token: string,
  opts?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "pending" | "assigned" | "executing" | "completed" | "failed" | "cancelled";
  budget_cents: number;
  deadline: string | null;
  max_execution_minutes: number | null;
  output_format: string | null;
  task_inputs: Record<string, unknown> | null;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  assigned_agent_slug: string | null;
  buyer_id: string;
  buyer_name: string | null;
  creator_id: string | null;
  result: string | null;
  result_url: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface WebhookConfig {
  webhook_url: string;
  webhook_secret: string | null;
  webhook_status: "connected" | "disconnected" | "error" | "untested";
  last_ping_at: string | null;
  max_concurrent_tasks: number;
  auto_accept: boolean;
  accepted_task_types: string[];
}

export interface TaskCreateData {
  title: string;
  description: string;
  category: string;
  budget_cents: number;
  deadline?: string;
  max_execution_minutes?: number;
  output_format?: string;
  task_inputs?: Record<string, unknown>;
  assigned_agent_id?: string;
}

// ── Task API ─────────────────────────────────────────────────

export async function getMyTasks(token: string): Promise<Task[]> {
  return taskFetch("/users/tasks", token);
}

export async function getCreatorTasks(token: string): Promise<Task[]> {
  return taskFetch("/users/creator-tasks", token);
}

export async function createTask(token: string, data: TaskCreateData): Promise<Task> {
  return taskFetch("/tasks", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTask(token: string, id: string): Promise<Task> {
  return taskFetch(`/tasks/${id}`, token);
}

export async function cancelTask(token: string, id: string): Promise<Task> {
  return taskFetch(`/tasks/${id}/cancel`, token, { method: "POST" });
}

// ── Webhook API ──────────────────────────────────────────────

export async function getWebhookConfig(token: string, agentId: string): Promise<WebhookConfig> {
  return taskFetch(`/agents/${agentId}/webhook`, token);
}

export async function updateWebhookConfig(
  token: string,
  agentId: string,
  data: Partial<WebhookConfig>
): Promise<WebhookConfig> {
  return taskFetch(`/agents/${agentId}/webhook`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function testWebhook(
  token: string,
  agentId: string
): Promise<{ success: boolean; response_ms: number; error?: string }> {
  return taskFetch(`/agents/${agentId}/webhook/test`, token, { method: "POST" });
}

export async function regenerateWebhookSecret(
  token: string,
  agentId: string
): Promise<{ webhook_secret: string }> {
  return taskFetch(`/agents/${agentId}/webhook/regenerate-secret`, token, { method: "POST" });
}
