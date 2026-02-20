"use client";

import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import {
  getWebhookConfig,
  updateWebhookConfig,
  testWebhook,
  regenerateWebhookSecret,
  type WebhookConfig as WebhookConfigType,
} from "@/lib/tasks";
import {
  Anchor,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  AlertTriangle,
  X,
  Plus,
} from "lucide-react";

interface WebhookConfigProps {
  agentId: string | null; // null when creating a new agent (not saved yet)
}

const inputClass =
  "w-full bg-[var(--bg-secondary)] border border-border rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors";

export default function WebhookConfigSection({ agentId }: WebhookConfigProps) {
  const [config, setConfig] = useState<Partial<WebhookConfigType>>({
    webhook_url: "",
    webhook_secret: null,
    webhook_status: "untested",
    last_ping_at: null,
    max_concurrent_tasks: 5,
    auto_accept: false,
    accepted_task_types: [],
  });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; ms?: number; error?: string } | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [taskTypeInput, setTaskTypeInput] = useState("");

  useEffect(() => {
    if (!agentId) return;
    const token = getToken();
    if (!token) return;
    setLoading(true);
    getWebhookConfig(token, agentId)
      .then(setConfig)
      .catch(() => {}) // endpoint may not exist yet
      .finally(() => setLoading(false));
  }, [agentId]);

  async function handleSaveWebhook() {
    if (!agentId) return;
    const token = getToken();
    if (!token) return;
    try {
      const updated = await updateWebhookConfig(token, agentId, config);
      setConfig(updated);
    } catch {
      // backend may not support this yet
    }
  }

  async function handleTest() {
    if (!agentId) return;
    const token = getToken();
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testWebhook(token, agentId);
      setTestResult({ success: result.success, ms: result.response_ms, error: result.error });
      if (result.success) {
        setConfig((c) => ({ ...c, webhook_status: "connected" as const, last_ping_at: new Date().toISOString() }));
      }
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  async function handleRegenerate() {
    if (!agentId) return;
    const token = getToken();
    if (!token) return;
    setRegenerating(true);
    setNewSecret(null);
    try {
      const result = await regenerateWebhookSecret(token, agentId);
      setNewSecret(result.webhook_secret);
      setConfig((c) => ({ ...c, webhook_secret: result.webhook_secret }));
    } catch {
      // ignore
    } finally {
      setRegenerating(false);
    }
  }

  function copySecret() {
    const secret = newSecret || config.webhook_secret;
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function addTaskType(e: React.KeyboardEvent) {
    if (e.key === "Enter" && taskTypeInput.trim()) {
      e.preventDefault();
      const types = config.accepted_task_types || [];
      if (!types.includes(taskTypeInput.trim())) {
        setConfig({ ...config, accepted_task_types: [...types, taskTypeInput.trim()] });
      }
      setTaskTypeInput("");
    }
  }

  function removeTaskType(type: string) {
    setConfig({
      ...config,
      accepted_task_types: (config.accepted_task_types || []).filter((t) => t !== type),
    });
  }

  const statusIcon = () => {
    switch (config.webhook_status) {
      case "connected":
        return <Wifi className="w-3.5 h-3.5 text-[var(--success)]" />;
      case "error":
        return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
      case "disconnected":
        return <WifiOff className="w-3.5 h-3.5 text-muted" />;
      default:
        return <WifiOff className="w-3.5 h-3.5 text-muted/40" />;
    }
  };

  const statusText = () => {
    switch (config.webhook_status) {
      case "connected":
        return (
          <span className="text-[var(--success)]">
            Connected {config.last_ping_at && `— Last ping ${timeAgo(config.last_ping_at)}`}
          </span>
        );
      case "error":
        return <span className="text-destructive">Error — Last ping failed</span>;
      case "disconnected":
        return <span className="text-muted">Disconnected</span>;
      default:
        return <span className="text-muted/60">Not tested yet</span>;
    }
  };

  if (loading) {
    return (
      <section className="animate-pulse">
        <div className="h-4 w-48 bg-border rounded mb-4" />
        <div className="h-32 bg-surface border border-border rounded-xl" />
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-2 flex items-center gap-2">
        <Anchor className="w-4 h-4" /> Docking Configuration
      </h3>
      <p className="text-xs text-muted mb-4">
        To allow your agent to receive and execute tasks through Swarm, configure a webhook endpoint.
      </p>

      <div className="space-y-4">
        {/* Webhook URL */}
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Webhook URL *</label>
          <input
            type="url"
            value={config.webhook_url || ""}
            onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
            className={inputClass}
            placeholder="https://your-server.com/agent/handle-task"
          />
        </div>

        {/* Webhook Secret */}
        <div>
          <label className="block text-sm font-medium text-muted mb-1">
            Webhook Secret {!agentId && <span className="text-muted/50">(generated on save)</span>}
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={
                  newSecret
                    ? newSecret
                    : config.webhook_secret
                    ? `whsec_${"•".repeat(24)}`
                    : ""
                }
                readOnly
                className={`${inputClass} font-mono text-xs pr-10`}
                placeholder="whsec_..."
              />
              {(newSecret || config.webhook_secret) && (
                <button
                  type="button"
                  onClick={copySecret}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            {agentId && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-xs text-muted hover:text-[var(--foreground)] hover:border-border-hover transition-colors disabled:opacity-50"
              >
                {regenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Regenerate
              </button>
            )}
          </div>
          {newSecret && (
            <p className="text-[10px] text-[var(--warning)] mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Store this secret securely. It won&apos;t be shown again.
            </p>
          )}
        </div>

        {/* Test + Status */}
        {agentId && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !config.webhook_url}
              className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:border-border-hover transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              Test Webhook
            </button>
            <div className="flex items-center gap-1.5 text-xs">
              {statusIcon()}
              {statusText()}
            </div>
          </div>
        )}

        {testResult && (
          <div
            className={`text-xs rounded-lg px-3 py-2 ${
              testResult.success
                ? "bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)]"
                : "bg-destructive/10 border border-destructive/30 text-destructive"
            }`}
          >
            {testResult.success
              ? `Ping successful (${testResult.ms}ms)`
              : `Ping failed: ${testResult.error}`}
          </div>
        )}

        {/* Save webhook config button */}
        {agentId && (
          <button
            type="button"
            onClick={handleSaveWebhook}
            className="text-xs text-accent hover:text-accent-hover transition-colors font-medium"
          >
            Save webhook configuration
          </button>
        )}

        {/* Divider */}
        <div className="border-t border-border pt-4">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Task Preferences</h4>

          <div className="space-y-3">
            {/* Max concurrent */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted w-44 shrink-0">Max concurrent tasks:</label>
              <select
                value={config.max_concurrent_tasks || 5}
                onChange={(e) =>
                  setConfig({ ...config, max_concurrent_tasks: Number(e.target.value) })
                }
                className="bg-[var(--bg-secondary)] border border-border rounded-lg px-2 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-accept */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.auto_accept || false}
                onChange={(e) => setConfig({ ...config, auto_accept: e.target.checked })}
                className="w-4 h-4 rounded border-border bg-[var(--bg-secondary)] text-accent focus:ring-accent/50"
              />
              <span className="text-sm text-muted">Auto-accept matching tasks</span>
            </label>

            {/* Accepted task types */}
            <div>
              <label className="block text-sm text-muted mb-1">
                Accepted task types <span className="text-muted/50">(press Enter to add)</span>
              </label>
              <input
                type="text"
                value={taskTypeInput}
                onChange={(e) => setTaskTypeInput(e.target.value)}
                onKeyDown={addTaskType}
                className={inputClass}
                placeholder="e.g. tax_filing, audit, review"
              />
              {(config.accepted_task_types || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(config.accepted_task_types || []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs rounded-md px-2 py-1"
                    >
                      {t}
                      <button type="button" onClick={() => removeTaskType(t)} className="hover:text-accent-hover">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
