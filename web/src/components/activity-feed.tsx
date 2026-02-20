"use client";

import { Bot, MessageSquare, CheckCircle, PlusCircle } from "lucide-react";

interface ActivityItem {
  type: string;
  message: string;
  timestamp: string;
  agentName?: string;
}

const ICON_MAP: Record<string, typeof Bot> = {
  task_completed: CheckCircle,
  message: MessageSquare,
  agent_docked: PlusCircle,
  default: Bot,
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function highlightAgentName(message: string, agentName?: string) {
  if (!agentName) return message;
  const idx = message.indexOf(agentName);
  if (idx === -1) return message;
  return (
    <>
      {message.slice(0, idx)}
      <span className="text-accent font-medium">{agentName}</span>
      {message.slice(idx + agentName.length)}
    </>
  );
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export default function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {items.map((item, i) => {
        const Icon = ICON_MAP[item.type] || ICON_MAP.default;
        return (
          <div
            key={i}
            className="flex items-start gap-3 py-3 border-b border-border last:border-0"
          >
            <div className="w-7 h-7 rounded-lg bg-surface-hover flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-3.5 h-3.5 text-muted" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--foreground)]">
                {highlightAgentName(item.message, item.agentName)}
              </p>
              <span className="text-xs text-muted">{timeAgo(item.timestamp)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
