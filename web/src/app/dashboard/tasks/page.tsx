"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getMyAgents, type AgentProfile } from "@/lib/api";
import { getCreatorTasks, type Task } from "@/lib/tasks";
import TaskCard from "@/components/task-card";
import { ClipboardList, Plus, Search } from "lucide-react";

type StatusGroup = "active" | "pending" | "completed" | "failed";

function groupStatus(status: Task["status"]): StatusGroup {
  if (status === "executing" || status === "assigned") return "active";
  if (status === "pending") return "pending";
  if (status === "completed") return "completed";
  return "failed";
}

const STATUS_ORDER: StatusGroup[] = ["active", "pending", "completed", "failed"];

const STATUS_LABELS: Record<StatusGroup, string> = {
  active: "In Progress",
  pending: "Pending",
  completed: "Completed",
  failed: "Failed / Cancelled",
};

const STATUS_ICONS: Record<StatusGroup, string> = {
  active: "text-accent",
  pending: "text-[var(--warning)]",
  completed: "text-[var(--success)]",
  failed: "text-destructive",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusGroup | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([
      getCreatorTasks(token).catch(() => []),
      getMyAgents(token).catch(() => []),
    ]).then(([t, a]) => {
      setTasks(t);
      setAgents(a);
      setLoading(false);
    });
  }, []);

  // Polling for active tasks
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const interval = setInterval(() => {
      getCreatorTasks(token)
        .then(setTasks)
        .catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const filtered = tasks.filter((t) => {
    if (filterAgent && t.assigned_agent_id !== filterAgent) return false;
    if (filterStatus !== "all" && groupStatus(t.status) !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assigned_agent_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const grouped = STATUS_ORDER.map((group) => ({
    group,
    tasks: filtered.filter((t) => groupStatus(t.status) === group),
  })).filter((g) => g.tasks.length > 0);

  const inputClass =
    "bg-[var(--bg-secondary)] border border-border rounded-lg px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-accent/50";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 bg-border rounded animate-pulse" />
          <div className="h-9 w-28 bg-border rounded animate-pulse" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-surface border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Task Command Center</h1>
          <p className="text-sm text-muted mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} across your fleet
          </p>
        </div>
        <Link
          href="/dashboard/tasks/new"
          className="flex items-center gap-2 bg-accent text-[var(--background)] font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> Post Task
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className={inputClass}
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusGroup | "all")}
          className={inputClass}
        >
          <option value="all">All Statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full`}
            placeholder="Search tasks..."
          />
        </div>
      </div>

      {/* Task groups */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            {tasks.length === 0 ? "No tasks yet" : "No matching tasks"}
          </h3>
          <p className="text-muted text-sm mb-6 max-w-md mx-auto">
            {tasks.length === 0
              ? "When buyers send tasks to your agents, they'll appear here."
              : "Try adjusting your filters."}
          </p>
          {tasks.length === 0 && (
            <Link
              href="/dashboard/tasks/new"
              className="inline-flex items-center gap-2 bg-accent text-[var(--background)] font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" /> Post Your First Task
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ group, tasks: groupTasks }) => (
            <div key={group}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${
                  group === "active" ? "bg-accent animate-pulse" :
                  group === "pending" ? "bg-[var(--warning)]" :
                  group === "completed" ? "bg-[var(--success)]" :
                  "bg-destructive"
                }`} />
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${STATUS_ICONS[group]}`}>
                  {STATUS_LABELS[group]} ({groupTasks.length})
                </h3>
              </div>
              <div className="space-y-2">
                {groupTasks.map((task) => (
                  <TaskCard key={task.id} task={task} viewAs="creator" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
