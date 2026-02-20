"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getConversations, type Conversation } from "@/lib/api";
import { MessageSquare, Bot } from "lucide-react";

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getConversations(token)
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === "unread"
      ? conversations.filter((c) => (c.unread_count || 0) > 0)
      : conversations;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-24 bg-border rounded animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-surface border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Messages</h1>
          <p className="text-sm text-muted mt-0.5">{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-0.5">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                filter === f
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            {filter === "unread" ? "All caught up" : "No conversations yet"}
          </h3>
          <p className="text-muted text-sm">
            {filter === "unread"
              ? "You have no unread messages."
              : "When someone messages you about your agents, conversations will appear here."}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
          {filtered.map((conv) => {
            const hasUnread = (conv.unread_count || 0) > 0;
            return (
              <Link
                key={conv.id}
                href={`/dashboard/messages/${conv.id}`}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-surface-hover transition-colors ${
                  hasUnread ? "border-l-2 border-l-accent" : ""
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm truncate ${hasUnread ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground)]"}`}>
                      {conv.subject || "Conversation"}
                    </span>
                    <span className="text-[10px] text-muted shrink-0 ml-2">
                      {conv.last_message_at ? timeAgo(conv.last_message_at) : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {conv.agent_name && (
                      <span className="text-xs text-accent">{conv.agent_name}</span>
                    )}
                    {conv.other_party_name && (
                      <span className="text-xs text-muted">
                        {conv.agent_name ? "· " : ""}{conv.other_party_name}
                      </span>
                    )}
                  </div>
                  {conv.last_message_preview && (
                    <p className="text-xs text-muted truncate mt-0.5">{conv.last_message_preview}</p>
                  )}
                </div>
                {hasUnread && (
                  <span className="w-5 h-5 bg-accent text-[var(--background)] text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                    {conv.unread_count! > 9 ? "9+" : conv.unread_count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
