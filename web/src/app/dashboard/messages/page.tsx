"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { getToken } from "@/lib/auth";
import { listConversations, createConversation } from "@/lib/api";
import type { Conversation } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent");
  const agentName = searchParams.get("name");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(!!agentId);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    listConversations(token)
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!agentId || !subject.trim() || !message.trim()) return;
    const token = getToken();
    if (!token) return;
    setSending(true);
    try {
      const conv = await createConversation(token, {
        agent_profile_id: agentId,
        subject: subject.trim(),
        message: message.trim(),
      });
      router.push(`/dashboard/messages/${conv.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create conversation");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Messages
        </h1>
      </div>

      {showNew && agentId && (
        <Card className="p-5 mb-6">
          <h2 className="font-heading font-bold text-foreground mb-3">
            New Conversation{agentName ? ` — ${agentName}` : ""}
          </h2>
          <div className="space-y-3">
            <Input
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What would you like to discuss?"
            />
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Write your message..."
                className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={sending}>
                {sending ? "Sending..." : "Send"}
              </Button>
              <Button variant="ghost" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : conversations.length === 0 && !showNew ? (
        <EmptyState
          icon={<MessageSquare className="w-12 h-12" />}
          heading="No messages yet"
          description="Start a conversation by contacting an agent from their profile page."
          actionLabel="Browse Agents"
          onAction={() => router.push("/browse")}
        />
      ) : (
        <Card>
          {conversations.map((conv, i) => (
            <button
              key={conv.id}
              onClick={() => router.push(`/dashboard/messages/${conv.id}`)}
              className={`w-full text-left p-4 hover:bg-surface-2 transition-colors flex items-center gap-3 ${
                i > 0 ? "border-t border-white/[0.04]" : ""
              }`}
            >
              <Avatar name={conv.agent_name || "Agent"} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {conv.agent_name || "Unknown Agent"}
                  </span>
                  {conv.unread_count > 0 && (
                    <span className="bg-accent text-background text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted font-medium truncate">
                  {conv.subject}
                </p>
                <p className="text-xs text-muted-2 truncate mt-0.5">
                  {conv.last_message_preview}
                </p>
              </div>
              {conv.last_message_at && (
                <span className="text-xs text-muted-2 shrink-0">
                  {new Date(conv.last_message_at).toLocaleDateString()}
                </span>
              )}
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
