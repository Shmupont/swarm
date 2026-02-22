"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, User, Loader2, Zap } from "lucide-react";
import { NavBar } from "@/components/navbar";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAgentBySlug,
  startChatSession,
  sendChatMessage,
  getChatSession,
  getCreditBalance,
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
  const [inlineError, setInlineError] = useState("");
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push(`/login?redirect=/agents/${slug}/chat`);
      return;
    }

    const token = getToken();
    if (!token || !slug) return;

    setLoading(true);
    Promise.all([
      getAgentBySlug(slug),
      getCreditBalance(token).catch(() => null),
    ])
      .then(([a, balance]) => {
        setAgent(a);
        if (balance) setCreditBalance(balance.credit_balance);

        if (!a.is_chat_ready) {
          setError("This agent is not configured for chat yet.");
          setLoading(false);
          return Promise.resolve(undefined);
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
        // Start new session
        return startChatSession(token, slug).then((s) => {
          setSession(s);
        });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to start chat";
        if (msg.toLowerCase().includes("no active license") || msg.includes("no_license")) {
          // Redirect to agent profile to hire
          router.push(`/agents/${slug}`);
          return;
        }
        if (msg.includes("insufficient_credits") || msg.includes("402")) {
          setError(`You need more credits to chat with this agent. Top up at /credits.`);
        } else if (msg.includes("not_configured") || msg.includes("503")) {
          setError("This agent isn't ready to chat yet.");
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [slug, router]);

  async function handleSend() {
    if (!input.trim() || sending || !session) return;
    const token = getToken();
    if (!token) return;

    const content = input.trim();
    setInput("");
    setSending(true);
    setInlineError("");

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
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        result.user_message,
        result.assistant_message,
      ]);
      // Update credit balance if returned
      if (result.credit_balance !== null && result.credit_balance !== undefined) {
        setCreditBalance(result.credit_balance);
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      const msg = err instanceof Error ? err.message : "Failed to send message";
      if (msg.includes("insufficient_credits") || msg.includes("402")) {
        setInlineError("⚡ Out of credits — ");
      } else if (msg.includes("no_license") || msg.includes("403")) {
        router.push(`/agents/${slug}`);
        return;
      } else if (msg.includes("not_configured") || msg.includes("503")) {
        setInlineError("This agent isn't ready to chat yet.");
      } else {
        setInlineError(msg);
        setInput(content); // restore for retry
      }
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
          <div className="text-center max-w-md px-4">
            <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-muted" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">
              {error.includes("credits") ? "Out of Credits" : "Chat Unavailable"}
            </h1>
            <p className="text-muted mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              {error.includes("credits") && (
                <Button onClick={() => router.push("/credits")}>
                  Top Up Credits
                </Button>
              )}
              <Button variant="secondary" onClick={() => router.push(`/agents/${slug}`)}>
                Back to Agent
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const welcomeMsg = agent?.welcome_message;
  const pricePerMsg = agent?.price_per_message_credits ?? 0;

  return (
    <div className="h-screen flex flex-col">
      <NavBar />

      <div className="flex-1 flex flex-col pt-16 min-h-0">
        {/* Chat header */}
        <div className="border-b border-border bg-background/90 backdrop-blur-sm shrink-0">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => router.push(`/agents/${slug}`)}
              className="text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {agent && (
              <>
                <Avatar src={agent.avatar_url} name={agent.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <h1 className="font-heading font-bold text-foreground text-sm truncate">
                    {agent.name}
                  </h1>
                  <p className="text-xs text-accent">Online</p>
                </div>
              </>
            )}
            {creditBalance !== null && (
              <div className="flex items-center gap-1.5 bg-surface-2 px-3 py-1.5 rounded-xl shrink-0">
                <Zap className="w-3.5 h-3.5 text-accent" />
                <span className="text-sm font-mono font-bold text-foreground">
                  {creditBalance.toLocaleString()}
                </span>
                <span className="text-xs text-muted">cr</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {/* Welcome state / welcome message */}
            {messages.length === 0 && !sending && (
              <div className="text-center py-10">
                {agent && (
                  <Avatar
                    src={agent.avatar_url}
                    name={agent.name}
                    size="xl"
                    className="mx-auto mb-4"
                  />
                )}
                <h2 className="font-heading text-lg font-bold text-foreground mb-2">
                  {welcomeMsg ? "" : `Chat with ${agent?.name}`}
                </h2>
                {welcomeMsg ? (
                  <div className="flex justify-start max-w-md mx-auto">
                    <div className="bg-surface-2 text-foreground rounded-2xl rounded-bl-md px-4 py-3 text-sm text-left">
                      <p className="whitespace-pre-wrap leading-relaxed">{welcomeMsg}</p>
                      <p className="text-[10px] mt-1.5 text-muted-2">
                        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted max-w-md mx-auto">
                    {agent?.tagline || "Start a conversation with this agent."}
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
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
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
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <p
                      className={`text-[10px] mt-1.5 ${
                        msg.role === "user" ? "text-background/60" : "text-muted-2"
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
                  <Avatar src={agent.avatar_url} name={agent.name} size="sm" className="shrink-0 mt-1" />
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

            {/* Inline error */}
            {inlineError && (
              <div className="text-center">
                <p className="text-sm bg-error/10 inline-flex items-center gap-1 px-4 py-2 rounded-xl text-error">
                  {inlineError}
                  {inlineError.includes("credits") && (
                    <a href="/credits" className="underline text-accent hover:text-accent-hover">
                      Top up
                    </a>
                  )}
                </p>
              </div>
            )}

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
        <div className="border-t border-border bg-background/90 backdrop-blur-sm shrink-0">
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
            {pricePerMsg > 0 && (
              <p className="text-xs text-muted mt-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3 text-accent" />
                {pricePerMsg} credits/message
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
