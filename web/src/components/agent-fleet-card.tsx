"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface AgentFleetCardProps {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  category: string;
  tasksCompleted: number;
  totalEarned: number;
}

function statusDot(status: string) {
  if (status === "active" || status === "true") return "bg-accent";
  if (status === "paused") return "bg-[var(--warning)]";
  return "bg-muted/40";
}

function statusLabel(status: string) {
  if (status === "active" || status === "true") return "Active";
  if (status === "paused") return "Paused";
  return "Idle";
}

export default function AgentFleetCard({
  id,
  name,
  avatarUrl,
  status,
  category,
  tasksCompleted,
  totalEarned,
}: AgentFleetCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 hover:border-border-hover transition-colors min-w-[200px] flex-shrink-0">
      <div className="flex items-center gap-3 mb-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-lg object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-bold text-sm">
            {name[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[var(--foreground)] truncate">{name}</h4>
          <span className="text-xs text-muted capitalize">{category.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <span className={`w-2 h-2 rounded-full ${statusDot(status)}`} />
        <span className="text-xs text-muted">{statusLabel(status)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div className="font-mono text-sm font-bold text-[var(--foreground)]">{tasksCompleted}</div>
          <div className="text-[10px] text-muted">Tasks done</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-[var(--foreground)]">
            ${(totalEarned / 100).toFixed(0)}
          </div>
          <div className="text-[10px] text-muted">Earned</div>
        </div>
      </div>

      <Link
        href={`/dashboard/agents/${id}/edit`}
        className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
      >
        Manage <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
