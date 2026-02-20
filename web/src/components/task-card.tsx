"use client";

import Link from "next/link";
import type { Task } from "@/lib/tasks";
import { Clock, DollarSign, Calendar, Bot, CheckCircle, XCircle, Loader2, Circle } from "lucide-react";

interface TaskCardProps {
  task: Task;
  viewAs: "creator" | "buyer";
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}hrs ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusConfig(status: Task["status"]) {
  switch (status) {
    case "executing":
      return {
        color: "text-accent",
        bg: "bg-accent/10",
        dot: "bg-accent animate-pulse",
        icon: Loader2,
        label: "Executing...",
        iconClass: "animate-spin",
      };
    case "pending":
      return {
        color: "text-[var(--warning)]",
        bg: "bg-[var(--warning)]/10",
        dot: "bg-[var(--warning)]",
        icon: Clock,
        label: "Pending",
        iconClass: "",
      };
    case "assigned":
      return {
        color: "text-blue-400",
        bg: "bg-blue-400/10",
        dot: "bg-blue-400",
        icon: Bot,
        label: "Assigned",
        iconClass: "",
      };
    case "completed":
      return {
        color: "text-[var(--success)]",
        bg: "bg-[var(--success)]/10",
        dot: "bg-[var(--success)]",
        icon: CheckCircle,
        label: "Completed",
        iconClass: "",
      };
    case "failed":
      return {
        color: "text-destructive",
        bg: "bg-destructive/10",
        dot: "bg-destructive",
        icon: XCircle,
        label: "Failed",
        iconClass: "",
      };
    case "cancelled":
      return {
        color: "text-muted",
        bg: "bg-surface-hover",
        dot: "bg-muted/40",
        icon: Circle,
        label: "Cancelled",
        iconClass: "",
      };
    default:
      return {
        color: "text-muted",
        bg: "bg-surface",
        dot: "bg-muted/40",
        icon: Circle,
        label: status,
        iconClass: "",
      };
  }
}

export default function TaskCard({ task, viewAs }: TaskCardProps) {
  const s = statusConfig(task.status);
  const StatusIcon = s.icon;

  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:border-border-hover transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-[var(--foreground)] truncate">{task.title}</h4>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            {task.assigned_agent_name && (
              <span className="flex items-center gap-1">
                <Bot className="w-3 h-3" />
                <span className="text-accent">{task.assigned_agent_name}</span>
              </span>
            )}
            {viewAs === "creator" && task.buyer_name && (
              <span>from {task.buyer_name}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          <StatusIcon className={`w-3.5 h-3.5 ${s.color} ${s.iconClass}`} />
          <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted mt-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-4 mt-3 text-[10px] text-muted font-mono border-t border-border pt-3">
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          ${(task.budget_cents / 100).toFixed(2)}
        </span>
        {task.deadline && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(task.created_at)}
        </span>
        {task.status === "completed" && task.completed_at && (
          <span className="text-[var(--success)]">
            Delivered {timeAgo(task.completed_at)}
          </span>
        )}
      </div>
    </div>
  );
}
