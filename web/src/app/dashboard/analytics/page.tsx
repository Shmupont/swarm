"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { getMyAgents, type AgentProfile } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { BarChart3, TrendingUp, Bot, DollarSign } from "lucide-react";

export default function AnalyticsPage() {
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

  const totalEarned = agents.reduce((sum, a) => sum + (a.total_earned_cents || 0), 0);
  const totalTasks = agents.reduce((sum, a) => sum + (a.tasks_completed || 0), 0);
  const totalHires = agents.reduce((sum, a) => sum + (a.total_hires || 0), 0);
  const avgRating =
    agents.filter((a) => a.avg_rating).length > 0
      ? agents.filter((a) => a.avg_rating).reduce((sum, a) => sum + (a.avg_rating || 0), 0) /
        agents.filter((a) => a.avg_rating).length
      : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-32 bg-border rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Analytics</h1>
        <p className="text-sm text-muted mt-0.5">Performance overview for your fleet</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: formatCurrency(totalEarned), icon: DollarSign, accent: true },
          { label: "Total Hires", value: totalHires, icon: TrendingUp },
          { label: "Tasks Completed", value: totalTasks, icon: BarChart3 },
          { label: "Avg Rating", value: avgRating ? avgRating.toFixed(1) : "—", icon: Bot },
        ].map((card) => (
          <div key={card.label} className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium text-muted uppercase tracking-wider">{card.label}</span>
              <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className={`font-mono text-3xl font-bold ${card.accent ? "text-accent" : "text-[var(--foreground)]"}`}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Per-Agent Breakdown */}
      {agents.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">Agent Breakdown</h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">Agent</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right">Hires</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right">Tasks</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right">Revenue</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right hidden sm:table-cell">Rating</th>
                </tr>
              </thead>
              <tbody>
                {agents
                  .sort((a, b) => (b.total_earned_cents || 0) - (a.total_earned_cents || 0))
                  .map((agent) => (
                    <tr key={agent.id} className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center text-xs font-bold shrink-0">
                            {agent.name[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-[var(--foreground)] truncate block">{agent.name}</span>
                            <span className="text-xs text-muted capitalize">{agent.category.replace(/-/g, " ")}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted">{agent.total_hires || 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted">{agent.tasks_completed || 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-accent">{formatCurrency(agent.total_earned_cents || 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted hidden sm:table-cell">
                        {agent.avg_rating ? agent.avg_rating.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue Distribution Bar */}
      {agents.length > 0 && totalEarned > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">Revenue Distribution</h2>
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
            {agents
              .filter((a) => (a.total_earned_cents || 0) > 0)
              .sort((a, b) => (b.total_earned_cents || 0) - (a.total_earned_cents || 0))
              .map((agent) => {
                const pct = ((agent.total_earned_cents || 0) / totalEarned) * 100;
                return (
                  <div key={agent.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-[var(--foreground)]">{agent.name}</span>
                      <span className="font-mono text-xs text-muted">
                        {formatCurrency(agent.total_earned_cents || 0)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {agents.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <BarChart3 className="w-12 h-12 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No analytics yet</h3>
          <p className="text-muted text-sm">Dock your first agent and analytics will appear here.</p>
        </div>
      )}
    </div>
  );
}
