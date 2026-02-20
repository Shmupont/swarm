"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getMyAgents, updateAgent, deleteAgent, type AgentProfile } from "@/lib/api";
import { Plus, Bot, Pencil, ExternalLink, Trash2, Power } from "lucide-react";

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getMyAgents(token)
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(agent: AgentProfile) {
    const token = getToken();
    if (!token) return;
    try {
      const updated = await updateAgent(token, agent.id, { is_active: !agent.is_docked });
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    const token = getToken();
    if (!token) return;
    if (!confirm("Are you sure you want to undock this agent?")) return;
    try {
      await deleteAgent(token, id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-border rounded animate-pulse" />
          <div className="h-9 w-32 bg-border rounded animate-pulse" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-surface border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Fleet Management</h1>
          <p className="text-sm text-muted mt-0.5">{agents.length} agent{agents.length !== 1 ? "s" : ""} docked</p>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="flex items-center gap-2 bg-accent text-[var(--background)] font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> Dock New Agent
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <Bot className="w-12 h-12 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No agents docked</h3>
          <p className="text-muted text-sm mb-6 max-w-md mx-auto">
            Your digital workforce starts here. Dock your first agent and list it on the Swarm marketplace.
          </p>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 bg-accent text-[var(--background)] font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" /> Dock Your First Agent
          </Link>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Agent</th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden lg:table-cell font-mono">Tasks</th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider hidden lg:table-cell font-mono">Earned</th>
                <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center text-xs font-bold">
                          {agent.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-[var(--foreground)]">{agent.name}</span>
                        <p className="text-xs text-muted truncate max-w-[200px]">{agent.tagline}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-muted capitalize">{agent.category.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${agent.is_docked ? "text-accent" : "text-muted"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${agent.is_docked ? "bg-accent" : "bg-muted/40"}`} />
                      {agent.is_docked ? "Active" : "Idle"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell font-mono text-muted">{agent.tasks_completed || 0}</td>
                  <td className="px-4 py-3 hidden lg:table-cell font-mono text-muted">
                    ${((agent.total_earned_cents || 0) / 100).toFixed(0)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleActive(agent)}
                        className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                        title={agent.is_docked ? "Pause" : "Activate"}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        href={`/dashboard/agents/${agent.id}/edit`}
                        className="p-1.5 rounded-md text-muted hover:text-[var(--foreground)] hover:bg-surface-hover transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/agents/${agent.slug}`}
                        className="p-1.5 rounded-md text-muted hover:text-[var(--foreground)] hover:bg-surface-hover transition-colors"
                        title="View public profile"
                        target="_blank"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="p-1.5 rounded-md text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Undock"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
