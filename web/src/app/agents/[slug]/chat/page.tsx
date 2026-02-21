"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Bot, User, Loader2 } from "lucide-react";
import { NavBar } from "@/components/navbar";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAgentBySlug,
  startChatSession,
  sendChatMessage,
  getChatSession,
} from "@/lib/api";
import { getToken, isLoggedIn } from "@/lib/auth";
import type { AgentProfile, ChatSession, ChatMessage } from "@/lib/api";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }

    const token = getToken();
    if (!token || !slug) return;

    setLoading(true);
    getAgentBySlug(slug)
      .then((a) => {
        setAgent(a);
        if (!a.is_chat_ready) {
          setError("This agent is not configured for chat yet.");
          setLoading(false);
          return;
        }
        // Check URL for existing session
        const urlParams = new URLSearchParams(window.location.search);
        const existingSessionId = urlParams.get("session");
        if (existingSessionId) {
          return getChatSession(token, existingSessionId).then((data) => {
            setSession(data.session);
            setMessages(data.messages);
          });
        }
        // Start a new session
        return startChatSession(token, slug).then((s) => {
          setSession(s);
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, router]);

  async function handleSend() {
    if (!input.trim() || sending || !session) return;
    const token = getToken();
    if (!token) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: session.id,
      role: "user",
      content,
      tokens_used: 0,
      model_used: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const result = await sendChatMessage(token, session.id, content);
      // Replace temp message with real ones
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        result.user_message,
        result.assistant_message,
      ]);
    } catch (err) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 pt-24 pb-12">
          <div className="max-w-3xl mx-auto px-4">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 pt-24 pb-12 flex items-center justify-center">
          <div className="text-center">
            <Bot className="w-12 h-12 text-muted-2 mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">
              Chat Unavailable
            </h1>
            <p className="text-muted mb-4">{error}</p>
            <Button onClick={() => router.push(`/agents/${slug}`)}>
              Back to Agent
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 pt-20 pb-0 flex flex-col">
        {/* Chat header */}
        <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-16 z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => router.push(`/agents/${slug}`)}
              className="text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {agent && (
              <>
                <Avatar
                  src={agent.avatar_url}
                  name={agent.name}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <h1 className="font-heading font-bold text-foreground text-sm truncate">
                    {agent.name}
                  </h1>
                  <p className="text-xs text-accent">Online</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {/* Welcome message */}
            {messages.length === 0 && !sending && (
              <div className="text-center py-12">
                {agent && (
                  <Avatar
                    src={agent.avatar_url}
                    name={agent.name}
                    size="xl"
                    className="mx-auto mb-4"
                  />
                )}
                <h2 className="font-heading text-lg font-bold text-foreground mb-2">
                  Chat with {agent?.name}
                </h2>
                <p className="text-sm text-muted max-w-md mx-auto">
                  {agent?.tagline || "Start a conversation with this agent."}
                </p>
                {!agent?.is_free && (
                  <p className="text-xs text-accent mt-2">
                    This is a paid agent.
                  </p>
                )}
              </div>
            )}

            {/* Message bubbles */}
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && agent && (
                    <Avatar
                      src={agent.avatar_url}
                      name={agent.name}
                      size="sm"
                      className="shrink-0 mt-1"
                    />
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-accent text-background rounded-br-md"
                        : "bg-surface-2 text-foreground rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                    <p
                      className={`text-[10px] mt-1.5 ${
                        msg.role === "user"
                          ? "text-background/60"
                          : "text-muted-2"
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-surface-2 text-accent flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 justify-start"
              >
                {agent && (
                  <Avatar
                    src={agent.avatar_url}
                    name={agent.name}
                    size="sm"
                    className="shrink-0 mt-1"
                  />
                )}
                <div className="bg-surface-2 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error message */}
            {error && session && (
              <div className="text-center">
                <p className="text-sm text-error bg-error/10 inline-block px-4 py-2 rounded-xl">
                  {error}
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-border bg-background/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${agent?.name || "agent"}...`}
                rows={1}
                className="flex-1 bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none text-sm max-h-32"
                style={{ minHeight: "44px" }}
                disabled={sending}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                size="md"
                className="shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
