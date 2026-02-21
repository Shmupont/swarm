"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getConversation, getMe, sendMessage, markRead } from "@/lib/api";
import type { Conversation, Message, User } from "@/lib/api";
import { MessageBubble } from "@/components/message-bubble";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationPage() {
  const params = useParams();
  const id = params.id as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function loadConversation() {
    const token = getToken();
    if (!token) return;
    try {
      const [data, user] = await Promise.all([
        getConversation(token, id),
        getMe(token),
      ]);
      setConversation(data.conversation);
      setMessages(data.messages);
      setMe(user);
      markRead(token, id).catch(() => {});
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConversation();
  }, [id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const token = getToken();
      if (!token) return;
      getConversation(token, id)
        .then((data) => {
          setMessages(data.messages);
          markRead(token, id).catch(() => {});
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const token = getToken();
    if (!token) return;
    setSending(true);
    try {
      const msg = await sendMessage(token, id, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch {
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <Skeleton className="h-12 mb-4" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="h-16 w-1/2 ml-auto" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 mb-4">
        <Link
          href="/dashboard/messages"
          className="text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-heading font-bold text-foreground">
            {conversation?.agent_name || "Conversation"}
          </h1>
          <p className="text-xs text-muted">{conversation?.subject}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-1">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            content={msg.content}
            senderName={msg.sender_name}
            isOwn={msg.sender_id === me?.id}
            timestamp={msg.created_at}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 pt-4 mt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-surface-2 rounded-2xl px-5 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-accent text-background rounded-2xl px-5 py-3 hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
