"use client";

import { useEffect, useState, useCallback } from "react";
import { Copy, Check, Trash2, Plus, Key, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getToken, isLoggedIn } from "@/lib/auth";
import { listMyAgents } from "@/lib/api";
import type { AgentProfile } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ApiKeysPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.href = "/login";
      return;
    }
    const token = getToken()!;
    listMyAgents(token)
      .then((list) => {
        setAgents(list);
        if (list.length > 0) setSelectedAgent(list[0].id);
      })
      .catch(() => setError("Failed to load agents"))
      .finally(() => setLoading(false));
  }, []);

  const loadKeys = useCallback(async (agentId: string) => {
    setKeysLoading(true);
    try {
      const res = await fetch(`${API_URL}/agents/${agentId}/api-keys`);
      const data = await res.json();
      setKeys(data);
    } catch {
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAgent) loadKeys(selectedAgent);
  }, [selectedAgent, loadKeys]);

  const handleGenerate = async () => {
    if (!selectedAgent) return;
    setGenerating(true);
    setNewKeyValue(null);
    try {
      const res = await fetch(`${API_URL}/agents/${selectedAgent}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "default" }),
      });
      const data = await res.json();
      setNewKeyValue(data.api_key);
      setNewKeyName("");
      loadKeys(selectedAgent);
    } catch {
      setError("Failed to generate key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!selectedAgent) return;
    await fetch(`${API_URL}/agents/${selectedAgent}/api-keys/${keyId}`, {
      method: "DELETE",
    });
    loadKeys(selectedAgent);
  };

  const copyKey = async (val: string) => {
    await navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-16">
        <Key className="w-10 h-10 text-muted-2 mx-auto mb-3" />
        <h2 className="font-heading text-lg font-bold text-foreground mb-2">No agents yet</h2>
        <p className="text-sm text-muted mb-4">Create an agent first to manage API keys.</p>
        <a href="/dashboard/agents/new">
          <Button>Create Agent</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-1">API Keys</h1>
        <p className="text-sm text-muted">
          Allow agents to authenticate programmatically using{" "}
          <code className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">X-Agent-Key</code>{" "}
          header.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Agent selector */}
      {agents.length > 1 && (
        <div>
          <label className="text-sm text-muted mb-2 block">Select Agent</label>
          <select
            value={selectedAgent || ""}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-foreground"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* One-time key reveal */}
      {newKeyValue && (
        <Card className="p-5 border border-accent/30">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-accent" />
            <span className="font-medium text-accent text-sm">New API Key — copy now, won&apos;t be shown again</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-surface-2 px-3 py-2 rounded-lg text-foreground break-all">
              {newKeyValue}
            </code>
            <button onClick={() => copyKey(newKeyValue)} className="shrink-0 text-muted hover:text-accent transition-colors">
              {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </Card>
      )}

      {/* Generate new key */}
      <Card className="p-5">
        <h2 className="font-heading text-sm font-bold text-foreground mb-3">Generate New Key</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Key name (optional)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-2"
          />
          <Button onClick={handleGenerate} disabled={generating} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            {generating ? "Generating..." : "Generate"}
          </Button>
        </div>
      </Card>

      {/* Existing keys */}
      <Card className="p-5">
        <h2 className="font-heading text-sm font-bold text-foreground mb-4">Existing Keys</h2>
        {keysLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">No keys yet.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-2 rounded-xl"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-accent">{k.key_prefix}...</code>
                    <span className="text-sm text-foreground truncate">{k.name}</span>
                    {!k.is_active && (
                      <span className="text-xs text-muted-2 bg-surface px-2 py-0.5 rounded-full">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted">Created {formatDate(k.created_at)}</span>
                    <span className="text-xs text-muted">Last used {formatDate(k.last_used_at)}</span>
                  </div>
                </div>
                {k.is_active && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="text-muted-2 hover:text-red-400 transition-colors shrink-0"
                    title="Revoke key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
