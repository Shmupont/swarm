"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import {
  getTask,
  getTaskEvents,
  acceptTaskResult,
  rejectTaskResult,
  type Task,
  type TaskEvent,
} from "@/lib/api";
import { formatCurrency, timeAgo, formatExecutionTime, TASK_STATUS_CONFIG } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Loader,
  AlertTriangle,
  CheckCircle,
  UserCheck,
  Bot,
  DollarSign,
  Calendar,
  Zap,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

const STATUS_ICONS: Record<string, React.ElementType> = {
  Clock, UserCheck, Send, CheckCircle, Loader, CheckCircle2, XCircle, AlertTriangle,
};

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([
      getTask(token, taskId),
      getTaskEvents(token, taskId).catch(() => []),
    ])
      .then(([t, e]) => {
        setTask(t);
        setEvents(e);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [taskId]);

  async function handleAccept() {
    const token = getToken();
    if (!token || !task) return;
    setActing(true);
    try {
      const updated = await acceptTaskResult(token, task.id, feedback || undefined);
      setTask(updated);
    } catch {}
    setActing(false);
  }

  async function handleReject() {
    const token = getToken();
    if (!token || !task) return;
    setActing(true);
    try {
      const updated = await rejectTaskResult(token, task.id, feedback || undefined);
      setTask(updated);
    } catch {}
    setActing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-muted mb-4">Task not found</p>
        <Link href="/dashboard/tasks" className="text-accent text-sm">Back to Tasks</Link>
      </div>
    );
  }

  const statusConfig = TASK_STATUS_CONFIG[task.status] || { label: task.status, color: "text-muted", icon: "Clock" };
  const StatusIcon = STATUS_ICONS[statusConfig.icon] || Clock;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/tasks"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--foreground)] transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Tasks
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">{task.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${statusConfig.color}`}>
                <StatusIcon className="w-4 h-4" />
                {statusConfig.label}
              </span>
              {task.agent_name && (
                <Link href={`/agents/${task.agent_slug}`} className="text-sm text-accent hover:text-accent-hover">
                  <span className="flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> {task.agent_name}</span>
                </Link>
              )}
            </div>
          </div>
          {task.budget_cents > 0 && (
            <div className="text-right">
              <div className="font-mono text-2xl font-bold text-accent">{formatCurrency(task.budget_cents)}</div>
              <span className="text-xs text-muted">{task.currency}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Calendar, label: "Created", value: timeAgo(task.created_at) },
          { icon: Clock, label: "Deadline", value: task.deadline ? timeAgo(task.deadline) : "None" },
          { icon: Zap, label: "Exec Time", value: task.execution_time_seconds ? formatExecutionTime(task.execution_time_seconds) : "—" },
          { icon: DollarSign, label: "Confidence", value: task.confidence_score ? `${(task.confidence_score * 100).toFixed(0)}%` : "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-border rounded-lg p-3 text-center">
            <stat.icon className="w-3.5 h-3.5 text-muted mx-auto mb-1" />
            <div className="text-sm font-mono font-semibold text-[var(--foreground)]">{stat.value}</div>
            <div className="text-[10px] text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Description */}
      {task.description && (
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Description</h2>
          <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{task.description}</p>
        </section>
      )}

      {/* Result */}
      {task.result_summary && (
        <section className="bg-surface border border-accent/30 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Result</h2>
          <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{task.result_summary}</p>
        </section>
      )}

      {/* Error */}
      {task.error_message && (
        <section className="bg-surface border border-destructive/30 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">Error</h2>
          <p className="text-sm text-destructive font-mono">{task.error_message}</p>
        </section>
      )}

      {/* Accept/Reject Controls */}
      {task.status === "completed" && task.buyer_accepted === null && (
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider mb-3">Review Result</h2>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Optional feedback..."
            className="w-full bg-[var(--bg-secondary)] border border-border rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none mb-3"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleAccept}
              disabled={acting}
              className="flex items-center gap-2 bg-accent text-[var(--background)] font-semibold rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <ThumbsUp className="w-4 h-4" /> Accept & Pay
            </button>
            <button
              onClick={handleReject}
              disabled={acting}
              className="flex items-center gap-2 border border-destructive/30 text-destructive font-medium rounded-lg px-4 py-2 text-sm hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <ThumbsDown className="w-4 h-4" /> Reject
            </button>
          </div>
        </section>
      )}

      {/* Buyer Feedback */}
      {task.buyer_feedback && (
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Buyer Feedback</h2>
          <p className="text-sm text-[var(--foreground)]">{task.buyer_feedback}</p>
          <span className={`text-xs mt-2 inline-block ${task.buyer_accepted ? "text-accent" : "text-destructive"}`}>
            {task.buyer_accepted ? "Accepted" : "Rejected"}
          </span>
        </section>
      )}

      {/* Event Timeline */}
      {events.length > 0 && (
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Timeline</h2>
          <div className="space-y-0">
            {events.map((event, i) => (
              <div key={event.id} className="flex gap-3 pb-4 last:pb-0 relative">
                {i < events.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                )}
                <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5 z-10">
                  <Zap className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-[var(--foreground)] capitalize">
                    {event.event_type.replace(/_/g, " ")}
                  </div>
                  <span className="text-[10px] text-muted">{timeAgo(event.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
