"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import {
  getConversation,
  getMe,
  sendMessage as apiSendMessage,
  markConversationRead,
  type Conversation,
  type Message,
  type User,
} from "@/lib/api";
import MessageBubble from "@/components/message-bubble";
import { ArrowLeft, Send, Loader2 } from "lucide-react";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([
      getConversation(token, conversationId),
      getMe(token),
    ])
      .then(([data, user]) => {
        setConversation(data.conversation);
        setMessages(data.messages);
        setMe(user);
        markConversationRead(token, conversationId).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const interval = setInterval(() => {
      getConversation(token, conversationId)
        .then((data) => {
          setMessages(data.messages);
          markConversationRead(token, conversationId).catch(() => {});
        })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [conversationId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const token = getToken();
    if (!token) return;

    setSending(true);
    try {
      const msg = await apiSendMessage(token, conversationId, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border shrink-0">
        <Link
          href="/dashboard/messages"
          className="text-muted hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--foreground)] truncate">
            {conversation?.subject || "Conversation"}
          </h2>
          <p className="text-xs text-muted">
            {conversation?.agent_name && (
              <span className="text-accent">{conversation.agent_name}</span>
            )}
            {conversation?.agent_name && conversation?.other_party_name && " · "}
            {conversation?.other_party_name}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted text-sm">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              content={msg.content}
              senderName={null}
              timestamp={msg.created_at}
              isOwn={msg.sender_id === me?.id}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-end gap-2 pt-3 border-t border-border shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          rows={1}
          placeholder="Type a message..."
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors resize-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-accent text-[var(--background)] rounded-lg p-2.5 hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
