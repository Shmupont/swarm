"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { NavBar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { TaskTimeline } from "@/components/TaskTimeline";
import type { TimelineStep } from "@/components/TaskTimeline";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTask, getTaskEvents, acceptTaskResult, rejectTaskResult } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { AgentTask, TaskEvent } from "@/lib/api";

const statusConfig: Record<string, { label: string; color: string; dotClass: string }> = {
  posted: { label: "Posted", color: "text-muted", dotClass: "bg-muted-2" },
  assigned: { label: "Assigned", color: "text-blue-400", dotClass: "bg-blue-400" },
  dispatched: { label: "Dispatched", color: "text-yellow-400", dotClass: "bg-yellow-400" },
  dispatch_failed: { label: "Dispatch Failed", color: "text-error", dotClass: "bg-error" },
  accepted: { label: "Accepted", color: "text-blue-400", dotClass: "bg-blue-400" },
  in_progress: { label: "In Progress", color: "text-accent", dotClass: "bg-accent animate-pulse" },
  completed: { label: "Completed", color: "text-accent", dotClass: "bg-accent" },
  failed: { label: "Failed", color: "text-error", dotClass: "bg-error" },
  expired: { label: "Expired", color: "text-muted", dotClass: "bg-muted-2" },
  cancelled: { label: "Cancelled", color: "text-muted", dotClass: "bg-muted-2" },
};

function buildTimeline(task: AgentTask, events: TaskEvent[]): TimelineStep[] {
  const steps: TimelineStep[] = [];

  const eventLabels: Record<string, string> = {
    posted: "Task posted",
    assigned: `Assigned to ${task.agent_name || "agent"}`,
    dispatched: `Dispatched to ${task.agent_name || "agent"}`,
    dispatch_failed: "Dispatch failed",
    accepted: "Agent accepted",
    completed: "Result delivered",
    failed: "Task failed",
    buyer_accepted: "Buyer accepted result",
    buyer_rejected: "Buyer rejected result",
    expired: "Task expired",
  };

  for (const event of events) {
    steps.push({
      label: eventLabels[event.event_type] || event.event_type,
      timestamp: event.created_at,
      status: "completed",
    });
  }

  const terminalStatuses = ["completed", "failed", "expired", "cancelled"];
  const hasResult = task.result_json || task.result_summary;
  const buyerReviewed = task.buyer_accepted !== null;

  if (!terminalStatuses.includes(task.status)) {
    if (task.status === "dispatched" || task.status === "assigned") {
      steps.push({ label: "Agent working...", timestamp: null, status: "active" });
      steps.push({ label: "Result delivered", timestamp: null, status: "pending" });
      steps.push({ label: "Buyer review", timestamp: null, status: "pending" });
    } else if (task.status === "posted") {
      steps.push({ label: "Awaiting agent assignment", timestamp: null, status: "active" });
    }
  } else if (hasResult && !buyerReviewed && task.status === "completed") {
    steps.push({ label: "Awaiting buyer review", timestamp: null, status: "active" });
  }

  return steps;
}

export default function TaskStatusPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<AgentTask | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    Promise.all([getTask(taskId), getTaskEvents(taskId)])
      .then(([t, e]) => { setTask(t); setEvents(e); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    if (!task) return;
    const terminal = ["completed", "failed", "expired", "cancelled"];
    if (terminal.includes(task.status) && task.buyer_accepted !== null) return;
    const interval = setInterval(() => {
      Promise.all([getTask(taskId), getTaskEvents(taskId)])
        .then(([t, e]) => { setTask(t); setEvents(e); })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [task, taskId]);

  const timeline = task ? buildTimeline(task, events) : [];

  const handleAccept = async () => {
    const token = getToken();
    if (!token || !task) return;
    setActionLoading(true);
    try {
      const updated = await acceptTaskResult(token, task.id);
      setTask(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to accept result");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Reject the result? The agent may retry the task.")) return;
    const token = getToken();
    if (!token || !task) return;
    setActionLoading(true);
    try {
      const updated = await rejectTaskResult(token, task.id);
      setTask(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reject result");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 pt-24 pb-12">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-48 mb-6" />
            <Skeleton className="h-64" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 pt-24 pb-12 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-muted-2 mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">
              Task Not Found
            </h1>
            <p className="text-muted mb-4">{error || "This task doesn't exist."}</p>
            <Button onClick={() => router.push("/browse")}>Browse Agents</Button>
          </div>
        </main>
      </div>
    );
  }

  const config = statusConfig[task.status] || statusConfig.posted;
  const hasResult = task.result_json || task.result_summary;
  const canReview = task.status === "completed" && task.buyer_accepted === null;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 pt-24 pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Task header */}
            <Card className="p-6 mb-6">
              <div className="mb-4">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                  {task.title}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      {(task.status === "in_progress" || task.status === "dispatched") && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                      )}
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dotClass}`} />
                    </span>
                    <span className={`text-sm font-medium ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  {task.buyer_accepted === true && (
                    <span className="flex items-center gap-1 text-xs text-accent">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-4 text-sm">
                {task.agent_name && (
                  <Link
                    href={`/agents/${task.agent_slug}`}
                    className="flex items-center gap-2 hover:text-accent transition-colors"
                  >
                    <span className="text-foreground font-medium">{task.agent_name}</span>
                    <span className="text-muted">@{task.agent_slug}</span>
                  </Link>
                )}
                <div className="flex items-center gap-1.5 text-muted">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Posted {new Date(task.created_at).toLocaleDateString()}</span>
                </div>
                {task.deadline && (
                  <div className="flex items-center gap-1.5 text-muted">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Due {new Date(task.deadline).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-muted">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span className="font-mono">${(task.budget_cents / 100).toFixed(2)}</span>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">
              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="font-heading text-lg font-bold text-foreground mb-4">
                    Timeline
                  </h2>
                  <TaskTimeline steps={timeline} />
                </Card>

                <Card className="p-6">
                  <h2 className="font-heading text-lg font-bold text-foreground mb-3">
                    Description
                  </h2>
                  <div className="text-muted text-sm leading-relaxed whitespace-pre-wrap">
                    {task.description}
                  </div>
                  {task.inputs_json && Object.keys(task.inputs_json).length > 0 && (
                    <div className="mt-4 pt-4">
                      <h3 className="text-sm font-medium text-foreground mb-2">Input Data</h3>
                      <pre className="bg-surface-2 rounded-xl p-4 text-xs font-mono text-muted overflow-x-auto">
                        {JSON.stringify(task.inputs_json, null, 2)}
                      </pre>
                    </div>
                  )}
                </Card>

                {hasResult && (
                  <Card className="p-6">
                    <h2 className="font-heading text-lg font-bold text-foreground mb-3">
                      Result
                    </h2>
                    {task.result_summary && (
                      <p className="text-muted text-sm leading-relaxed mb-4">
                        {task.result_summary}
                      </p>
                    )}
                    {task.execution_time_seconds && (
                      <p className="text-xs text-muted-2 mb-2">
                        Execution time: <span className="font-mono">{task.execution_time_seconds}s</span>
                        {task.confidence_score && (
                          <> &middot; Confidence: <span className="font-mono">{(task.confidence_score * 100).toFixed(0)}%</span></>
                        )}
                      </p>
                    )}
                    {task.result_json && (
                      <pre className="bg-surface-2 rounded-xl p-4 text-xs font-mono text-muted overflow-x-auto">
                        {JSON.stringify(task.result_json, null, 2)}
                      </pre>
                    )}

                    {canReview && (
                      <div className="flex items-center gap-3 mt-6 pt-4">
                        <Button
                          onClick={handleAccept}
                          disabled={actionLoading}
                          className="flex-1 gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Accept Result
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={handleReject}
                          disabled={actionLoading}
                          className="flex-1 gap-2 hover:text-error"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject &amp; Retry
                        </Button>
                      </div>
                    )}
                  </Card>
                )}

                {task.error_message && (
                  <Card className="p-6">
                    <h2 className="font-heading text-lg font-bold text-error mb-3">
                      Error
                    </h2>
                    <p className="text-muted text-sm">{task.error_message}</p>
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                <Card className="p-5">
                  <h3 className="font-heading text-sm font-bold text-foreground mb-3">
                    Task Info
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">Status</span>
                      <span className={`font-medium ${config.color}`}>{config.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Category</span>
                      <span className="text-foreground capitalize">{task.category.replace(/-/g, " ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Budget</span>
                      <span className="text-foreground font-mono">${(task.budget_cents / 100).toFixed(2)}</span>
                    </div>
                    {task.buyer_display_name && (
                      <div className="flex justify-between">
                        <span className="text-muted">Posted by</span>
                        <span className="text-foreground">{task.buyer_display_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted">Created</span>
                      <span className="text-foreground font-mono text-xs">
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Deadline</span>
                      <span className="text-foreground font-mono text-xs">
                        {new Date(task.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Card>

                {task.agent_name && (
                  <Card className="p-5">
                    <h3 className="font-heading text-sm font-bold text-foreground mb-3">
                      Assigned Agent
                    </h3>
                    <Link
                      href={`/agents/${task.agent_slug}`}
                      className="flex items-center gap-3 group"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                          {task.agent_name}
                        </p>
                        <p className="text-xs text-muted">@{task.agent_slug}</p>
                      </div>
                    </Link>
                  </Card>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
