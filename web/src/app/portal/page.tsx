"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Zap, X, Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { isLoggedIn, getToken, clearToken } from "@/lib/auth";
import {
  getMe,
  getCreditBalance,
  browseAgents,
  listChatSessions,
  getAssistantResponse,
} from "@/lib/api";
import type { User, AgentProfile, ChatSession, AssistantMessage } from "@/lib/api";
import { getCategoryLabel } from "@/lib/categories";

const CATEGORY_CHIPS = [
  { value: "finance", label: "Finance" },
  { value: "writing", label: "Writing" },
  { value: "software-development", label: "Code" },
  { value: "legal", label: "Legal" },
  { value: "research", label: "Research" },
  { value: "marketing", label: "Marketing" },
  { value: "data-analysis", label: "Data" },
  { value: "customer-support", label: "Support" },
];

function PortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "";

  const [user, setUser] = useState<User | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [mySessions, setMySessions] = useState<ChatSession[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Assistant chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<AssistantMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    const token = getToken()!;
    getMe(token).then(setUser).catch(() => { clearToken(); router.replace("/login"); });
    getCreditBalance(token).then((r) => setCreditBalance(r.credit_balance)).catch(() => {});
    listChatSessions(token).then(setMySessions).catch(() => {});
  }, [router]);

  useEffect(() => {
    setLoadingAgents(true);
    browseAgents({
      category: selectedCategory || undefined,
      search: search || undefined,
      limit: 12,
    })
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoadingAgents(false));
  }, [selectedCategory, search]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleLogout = () => {
    clearToken();
    window.location.href = "/";
  };

  const sendAssistantMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const token = getToken();
    if (!token) return;
    const userMsg: AssistantMessage = { role: "user", content: chatInput.trim() };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await getAssistantResponse(userMsg.content, chatMessages, token);
      setChatMessages([...newHistory, { role: "assistant", content: res.response }]);
    } catch {
      setChatMessages([...newHistory, { role: "assistant", content: "Sorry, I'm having trouble right now. Try again in a moment." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Unique agents from sessions
  const hiredAgentIds = new Set(mySessions.map((s) => s.agent_profile_id));
  const myAgents = agents.filter((a) => hiredAgentIds.has(a.id));
  const exploreAgents = agents.filter((a) => !hiredAgentIds.has(a.id));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#04080f]">
      {/* Portal Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a2d4a]"
        style={{ background: "rgba(4, 8, 15, 0.90)", backdropFilter: "blur(24px)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/portal" className="font-display font-bold text-lg text-white tracking-tight">
              SWARM
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/browse" className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors">Browse</Link>
              <Link href="/portal" className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors">My Agents</Link>
              <Link href="/credits" className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors">Credits</Link>
            </div>
            <div className="flex items-center gap-3">
              {creditBalance !== null && (
                <Link href="/dashboard/credits" className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 text-accent px-3 py-1.5 rounded-xl text-sm font-medium transition-colors">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Balance: ${(creditBalance / 100).toFixed(2)}</span>
                  <span className="text-xs text-accent/70">↑ Add funds</span>
                </Link>
              )}
              {user && (
                <>
                  <Avatar src={user.avatar_url} name={user.display_name || user.email} size="sm" />
                  <button onClick={handleLogout} className="text-xs text-muted-2 hover:text-foreground transition-colors">
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-24">
        {/* Greeting + Search */}
        <div className="mb-10">
          <h1 className="font-display font-bold text-3xl text-white mb-6">
            {greeting}. What do you need done today?
          </h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="w-full bg-surface border border-[#1a2d4a] rounded-2xl pl-12 pr-4 py-4 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 text-lg"
            />
          </div>
        </div>

        {/* My Agents */}
        {mySessions.length > 0 && (
          <div className="mb-10">
            <h2 className="font-heading font-bold text-foreground text-sm uppercase tracking-widest mb-4">
              Your Agents
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {mySessions.slice(0, 6).map((session) => {
                const agent = agents.find((a) => a.id === session.agent_profile_id);
                return (
                  <Link
                    key={session.id}
                    href={`/agents/${session.agent_slug || session.agent_profile_id}/chat`}
                    className="p-4 rounded-2xl border border-[#1a2d4a] hover:border-accent/40 transition-all"
                    style={{ background: "#080f1e" }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar src={session.agent_avatar_url} name={session.agent_name || "Agent"} size="sm" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{session.agent_name}</p>
                        {agent && <p className="text-xs text-muted">{getCategoryLabel(agent.category)}</p>}
                      </div>
                    </div>
                    <span className="text-xs text-accent font-medium">Chat →</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Explore */}
        <div>
          <h2 className="font-heading font-bold text-foreground text-sm uppercase tracking-widest mb-4">
            Explore
          </h2>
          {/* Category chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                !selectedCategory
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-surface-2 bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              All
            </button>
            {CATEGORY_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setSelectedCategory(chip.value === selectedCategory ? "" : chip.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  selectedCategory === chip.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-surface-2 bg-surface-2 text-muted hover:text-foreground"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Agent grid */}
          {loadingAgents ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-surface animate-pulse" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-muted text-center py-12">No agents found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.slug}`}
                  className="p-5 rounded-2xl border border-[#1a2d4a] hover:border-accent/40 transition-all group"
                  style={{ background: "#080f1e" }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar src={agent.avatar_url} name={agent.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{agent.name}</p>
                      <p className="text-xs text-muted">{getCategoryLabel(agent.category)}</p>
                    </div>
                  </div>
                  {agent.tagline && (
                    <p className="text-xs text-muted line-clamp-2 mb-3">{agent.tagline}</p>
                  )}
                  <div className="flex items-center justify-between">
                    {agent.price_per_message_credits > 0 ? (
                      <span className="text-xs text-accent">⚡ {agent.price_per_message_credits} credits/msg</span>
                    ) : (
                      <span className="text-xs text-emerald-400">Free</span>
                    )}
                    <span className="text-xs text-muted group-hover:text-accent transition-colors">View →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Assistant Chat */}
      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen && (
          <div
            className="mb-3 w-80 h-96 flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-[#1a2d4a]"
            style={{ background: "#080f1e" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2d4a]">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-foreground">SWARM Assistant</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-muted hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="p-3 rounded-xl bg-surface-2 text-sm text-muted">
                  Hi! I&apos;m your SWARM guide. Ask me anything about the platform.
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-accent/10 text-accent ml-4"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="p-3 rounded-xl bg-surface-2 text-sm text-muted animate-pulse">
                  Thinking...
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-3 border-t border-[#1a2d4a]">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendAssistantMessage()}
                placeholder="Ask me anything..."
                className="flex-1 bg-surface-2 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <button
                onClick={sendAssistantMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="text-accent hover:text-accent-hover disabled:opacity-50 disabled:pointer-events-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setChatOpen((o) => !o)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-3 rounded-2xl shadow-lg transition-all font-medium text-sm"
        >
          💬 Help?
        </button>
      </div>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense>
      <PortalContent />
    </Suspense>
  );
}
