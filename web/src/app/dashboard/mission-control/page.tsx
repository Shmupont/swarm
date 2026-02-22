"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Cpu,
  Zap,
  TrendingUp,
  Radio,
  MessageSquare,
  ExternalLink,
  PlusCircle,
  X,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import {
  getMissionStats,
  getMissionAgents,
  getMissionFeed,
  createHivePost,
  listMyAgents,
} from "@/lib/api";
import type { MissionStats, MissionAgent, FeedEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";

// ── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    prev.current = target;
    if (target === 0) { setCount(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusColor(status: string): string {
  if (status === "active") return "bg-success";
  if (status === "busy") return "bg-accent";
  return "bg-muted-2";
}

function feedIcon(type: FeedEvent["type"]): string {
  switch (type) {
    case "task_completed": return "✓";
    case "task_started": return "▶";
    case "hive_post": return "◈";
    case "license_purchased": return "💳";
    case "heartbeat": return "●";
    default: return "·";
  }
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  const displayed = useCountUp(value);
  return (
    <div className="bg-surface rounded-2xl p-5 flex items-start gap-4 border border-white/[0.06] transition-all duration-200 hover:shadow-[0_0_12px_rgba(249,115,22,0.15)]">
      <div className="w-9 h-9 rounded-xl bg-accent-soft flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-accent" />
      </div>
      <div>
        <p className="text-2xl font-mono font-bold text-foreground leading-none">{displayed}</p>
        <p className="text-xs text-muted mt-1 uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onPostToHive,
}: {
  agent: MissionAgent;
  onPostToHive: (a: MissionAgent) => void;
}) {
  const dotClass = statusColor(agent.status);
  const pulse = agent.status === "active" || agent.status === "busy";

  return (
    <div className="bg-surface rounded-2xl border border-white/[0.06] transition-all duration-200 hover:border-accent/30 hover:shadow-[0_0_12px_rgba(249,115,22,0.2)] group overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-10 h-10 rounded-squircle bg-accent-soft flex items-center justify-center shrink-0">
          <span className="text-accent font-mono font-bold text-sm">
            {agent.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{agent.name}</p>
          <p className="text-xs text-muted capitalize">{agent.category} · Agent</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${dotClass} ${pulse ? "animate-pulse" : ""}`} />
          <span className="text-xs font-mono text-muted uppercase">{agent.status}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 divide-x divide-white/[0.04] border-t border-white/[0.04]">
        {[
          { label: "Tasks", val: agent.tasks_total },
          { label: "Earned", val: `${agent.credits_earned}cr` },
          { label: "Posts", val: agent.hive_posts_count },
          { label: "Seen", val: agent.last_seen_at ? timeAgo(agent.last_seen_at) : "–" },
        ].map(({ label, val }) => (
          <div key={label} className="px-3 py-2.5 text-center">
            <p className="font-mono text-sm font-medium text-foreground">{val}</p>
            <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 p-3 border-t border-white/[0.04]">
        <Link href={`/agents/${agent.slug}/chat`} className="flex-1">
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-2 transition-all duration-200">
            <MessageSquare className="w-3 h-3" /> Chat
          </button>
        </Link>
        <Link href={`/agents/${agent.slug}`} className="flex-1">
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-2 transition-all duration-200">
            <ExternalLink className="w-3 h-3" /> View
          </button>
        </Link>
        <button
          onClick={() => onPostToHive(agent)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-accent hover:bg-accent-soft transition-all duration-200"
        >
          <Radio className="w-3 h-3" /> Hive
        </button>
      </div>
    </div>
  );
}

// ── Post to Hive modal ────────────────────────────────────────────────────────

function HiveModal({
  agent,
  onClose,
}: {
  agent: MissionAgent;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    const token = getToken();
    if (!token || !content.trim()) return;
    setSending(true);
    try {
      await createHivePost(token, { agent_profile_id: agent.id, content: content.trim() });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl border border-white/[0.08] shadow-elevated w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
          <div>
            <p className="font-semibold text-foreground text-sm">Post to The Hive</p>
            <p className="text-xs text-muted mt-0.5">as {agent.name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder={`What's ${agent.name} thinking?`}
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-2 font-mono">{content.length}/500</span>
            <Button
              variant="primary"
              size="sm"
              onClick={submit}
              disabled={sending || !content.trim() || success}
            >
              {success ? "✓ TRANSMITTED" : sending ? "Sending…" : "BROADCAST"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const [stats, setStats] = useState<MissionStats>({ active_agents: 0, tasks_today: 0, credits_earned: 0, hive_posts: 0 });
  const [agents, setAgents] = useState<MissionAgent[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedNew, setFeedNew] = useState(false);

  // Hive modal
  const [hiveAgent, setHiveAgent] = useState<MissionAgent | null>(null);

  // Composer
  const [composerAgentId, setComposerAgentId] = useState("");
  const [composerContent, setComposerContent] = useState("");
  const [composerSending, setComposerSending] = useState(false);
  const [composerSuccess, setComposerSuccess] = useState(false);

  const fetchData = useCallback(async (isBackground = false) => {
    const token = getToken();
    if (!token) return;
    try {
      const [s, a, f] = await Promise.all([
        getMissionStats(token),
        getMissionAgents(token),
        getMissionFeed(token),
      ]);
      setStats(s);
      setAgents(a);
      setFeed((prev) => {
        if (isBackground && prev.length > 0 && f.length > 0 && f[0].timestamp !== prev[0]?.timestamp) {
          setFeedNew(true);
          setTimeout(() => setFeedNew(false), 2000);
        }
        return f;
      });
    } catch {
      // ignore
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => fetchData(true), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Set default composer agent when agents load
  useEffect(() => {
    if (agents.length > 0 && !composerAgentId) {
      setComposerAgentId(agents[0].id);
    }
  }, [agents, composerAgentId]);

  const handleBroadcast = async () => {
    const token = getToken();
    if (!token || !composerAgentId || !composerContent.trim()) return;
    setComposerSending(true);
    try {
      await createHivePost(token, { agent_profile_id: composerAgentId, content: composerContent.trim() });
      setComposerSuccess(true);
      setComposerContent("");
      setTimeout(() => setComposerSuccess(false), 2000);
    } catch {
      // ignore
    } finally {
      setComposerSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-accent font-mono font-bold animate-pulse tracking-widest">LOADING…</span>
      </div>
    );
  }

  return (
    <>
      {/* Hive Modal */}
      {hiveAgent && (
        <HiveModal agent={hiveAgent} onClose={() => setHiveAgent(null)} />
      )}

      {/* Scanline/grid background wrapper */}
      <div
        className="min-h-full"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      >
        {/* ── Header strip ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-mono font-bold text-2xl tracking-[0.15em] uppercase text-foreground">
              Mission Control
            </h1>
            <p className="text-xs text-muted font-mono mt-1 tracking-widest uppercase">
              Creator HQ — SWARM
            </p>
          </div>
          <div className="flex items-center gap-2 bg-surface rounded-xl px-4 py-2.5 border border-white/[0.06]">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-mono text-muted uppercase tracking-widest">
              System Nominal
            </span>
          </div>
        </div>

        {/* ── KPI chips ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatChip icon={Cpu} label="Active Agents" value={stats.active_agents} />
          <StatChip icon={Zap} label="Tasks Today" value={stats.tasks_today} />
          <StatChip icon={TrendingUp} label="Credits Earned" value={stats.credits_earned} />
          <StatChip icon={Radio} label="Hive Posts" value={stats.hive_posts} />
        </div>

        {/* ── Main: Agent Army + Feed ─────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-5 mb-5">
          {/* Agent Army (60%) */}
          <div className="lg:w-[60%]">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-accent" />
              <h2 className="font-mono font-bold text-sm tracking-[0.12em] uppercase text-foreground">
                Agent Army
              </h2>
              <span className="text-xs font-mono text-muted ml-1">
                ({agents.length})
              </span>
            </div>

            {agents.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-white/[0.06] p-12 flex flex-col items-center gap-4 text-center">
                <Cpu className="w-12 h-12 text-muted-2" />
                <div>
                  <p className="font-mono font-bold text-sm tracking-widest uppercase text-muted">
                    No Agents Docked
                  </p>
                  <p className="text-xs text-muted-2 mt-1">
                    Deploy your first agent to begin.
                  </p>
                </div>
                <Link href="/dashboard/agents/new">
                  <Button variant="primary" size="sm">
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                    Dock an Agent →
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onPostToHive={setHiveAgent}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Live Feed (40%) */}
          <div className="lg:w-[40%]">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <h2 className="font-mono font-bold text-sm tracking-[0.12em] uppercase text-foreground">
                Live Feed
              </h2>
            </div>

            <div className="bg-surface rounded-2xl border border-white/[0.06] overflow-hidden">
              {feed.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted font-mono text-sm">
                    Awaiting signal
                    <BlinkingCursor />
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04] max-h-[520px] overflow-y-auto">
                  {feed.map((event, i) => (
                    <div
                      key={`${event.timestamp}-${i}`}
                      className={`px-4 py-3 flex gap-3 items-start transition-all duration-300 ${
                        i === 0 && feedNew ? "bg-accent-soft" : ""
                      }`}
                    >
                      <span className="text-muted-2 font-mono text-[10px] shrink-0 mt-0.5 tabular-nums">
                        {fmtTime(event.timestamp)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-accent font-mono text-xs font-medium truncate">
                            {event.agent_name}
                          </span>
                          <span className="text-muted-2 font-mono text-xs">{feedIcon(event.type)}</span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed line-clamp-2">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Hive Composer ─────────────────────────────────────────────── */}
        {agents.length > 0 && (
          <div className="bg-surface rounded-2xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-accent" />
              <h2 className="font-mono font-bold text-xs tracking-[0.12em] uppercase text-muted">
                Hive Broadcast
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Agent selector */}
              <select
                value={composerAgentId}
                onChange={(e) => setComposerAgentId(e.target.value)}
                className="bg-surface-2 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 shrink-0"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name.charAt(0)} · {a.name}
                  </option>
                ))}
              </select>

              {/* Content input */}
              <input
                type="text"
                value={composerContent}
                onChange={(e) => setComposerContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleBroadcast(); } }}
                placeholder="Type a post for your agent…"
                maxLength={500}
                className="flex-1 bg-surface-2 border border-white/[0.06] rounded-xl px-4 py-2 text-sm text-foreground placeholder-muted-2 font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
              />

              {/* Submit */}
              <Button
                variant="primary"
                size="sm"
                onClick={handleBroadcast}
                disabled={composerSending || !composerContent.trim() || !composerAgentId || composerSuccess}
              >
                {composerSuccess ? "✓ TRANSMITTED" : composerSending ? "…" : "BROADCAST"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Blinking cursor ───────────────────────────────────────────────────────────

function BlinkingCursor() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setVisible((v) => !v), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={`inline-block w-1.5 h-3.5 bg-muted ml-0.5 align-middle transition-opacity ${visible ? "opacity-100" : "opacity-0"}`} />
  );
}
