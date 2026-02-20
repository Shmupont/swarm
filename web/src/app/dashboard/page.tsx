"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getMyAgents, getConversations, type AgentProfile, type Conversation } from "@/lib/api";
import { getCreatorTasks, type Task } from "@/lib/tasks";
import MetricCard from "@/components/metric-card";
import AgentFleetCard from "@/components/agent-fleet-card";
import ActivityFeed from "@/components/activity-feed";
import { Bot, ClipboardList, DollarSign, MessageSquare, Plus, ArrowRight, Zap, Star, Send } from "lucide-react";

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([
      getMyAgents(token).catch(() => []),
      getConversations(token).catch(() => []),
      getCreatorTasks(token).catch(() => []),
    ]).then(([a, c, t]) => {
      setAgents(a);
      setConversations(c);
      setTasks(t);
      setLoading(false);
    });
  }, []);

  const totalEarned = agents.reduce((sum, a) => sum + (a.total_earned_cents || 0), 0);
  const totalTasks = agents.reduce((sum, a) => sum + (a.tasks_completed || 0), 0);
  const totalHires = agents.reduce((sum, a) => sum + (a.total_hires || 0), 0);
  const activeTasks = tasks.filter((t) => t.status === "executing" || t.status === "assigned").length;
  const unreadMessages = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  const recentActivity = [
    ...agents.map((a) => ({
      type: "agent_docked",
      message: `${a.name} was docked in the Swarm`,
      timestamp: a.created_at,
      agentName: a.name,
    })),
    ...conversations
      .filter((c) => c.last_message_at)
      .map((c) => ({
        type: "message",
        message: `New message about ${c.agent_name || "an agent"} from ${c.other_party_name || "someone"}`,
        timestamp: c.last_message_at!,
        agentName: c.agent_name || undefined,
      })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 animate-pulse">
              <div className="h-3 w-20 bg-border rounded mb-4" />
              <div className="h-8 w-16 bg-border rounded mb-2" />
              <div className="h-2 w-24 bg-border rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Command Center</h1>
          <p className="text-sm text-muted mt-0.5">Your fleet at a glance</p>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="flex items-center gap-2 bg-accent text-[var(--background)] font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> Dock Agent
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Agents Docked"
          value={agents.length}
          sublabel="in your fleet"
          icon={Bot}
        />
        <MetricCard
          label="Active Tasks"
          value={activeTasks}
          sublabel={`${tasks.length} total posted`}
          icon={ClipboardList}
          trend={activeTasks > 0 ? { value: `${activeTasks} running`, positive: true } : undefined}
        />
        <MetricCard
          label="Total Hires"
          value={totalHires}
          sublabel="across all agents"
          icon={Star}
        />
        <MetricCard
          label="Total Earned"
          value={`$${(totalEarned / 100).toLocaleString()}`}
          sublabel="lifetime earnings"
          icon={DollarSign}
        />
        <MetricCard
          label="Messages"
          value={conversations.length}
          sublabel={unreadMessages > 0 ? `${unreadMessages} unread` : "all caught up"}
          icon={MessageSquare}
          trend={unreadMessages > 0 ? { value: `${unreadMessages} new`, positive: true } : undefined}
        />
      </div>

      {/* Agent Fleet */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" /> Your Fleet
          </h2>
          <Link
            href="/dashboard/agents"
            className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {agents.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center">
            <Bot className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <p className="text-muted text-sm mb-4">
              You haven&apos;t docked any agents yet. Your digital workforce starts here.
            </p>
            <Link
              href="/dashboard/agents/new"
              className="inline-flex items-center gap-2 bg-accent text-[var(--background)] font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" /> Dock Your First Agent
            </Link>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {agents.map((agent) => (
              <AgentFleetCard
                key={agent.id}
                id={agent.id}
                name={agent.name}
                avatarUrl={agent.avatar_url}
                status={agent.is_docked ? "active" : "idle"}
                category={agent.category}
                tasksCompleted={agent.tasks_completed || 0}
                totalEarned={agent.total_earned_cents || 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Recent Activity</h3>
          <ActivityFeed items={recentActivity} />
        </div>

        {/* Quick Actions */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              href="/dashboard/agents/new"
              className="flex items-center gap-3 w-full bg-accent text-[var(--background)] font-semibold rounded-lg px-4 py-3 text-sm hover:bg-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" /> Dock a New Agent
            </Link>
            <Link
              href="/dashboard/tasks/new"
              className="flex items-center gap-3 w-full border border-border text-[var(--foreground)] font-medium rounded-lg px-4 py-3 text-sm hover:bg-surface-hover transition-colors"
            >
              <Send className="w-4 h-4 text-muted" /> Post a Task
            </Link>
            <Link
              href="/dashboard/messages"
              className="flex items-center gap-3 w-full border border-border text-[var(--foreground)] font-medium rounded-lg px-4 py-3 text-sm hover:bg-surface-hover transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-muted" /> View Messages
            </Link>
            <Link
              href="/browse"
              className="flex items-center gap-3 w-full border border-border text-[var(--foreground)] font-medium rounded-lg px-4 py-3 text-sm hover:bg-surface-hover transition-colors"
            >
              <ArrowRight className="w-4 h-4 text-muted" /> View Marketplace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
