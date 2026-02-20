"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  Clock,
  CheckCircle,
  DollarSign,
  MessageSquare,
  ExternalLink,
  Github,
  Globe,
  Tag,
  Bot,
} from "lucide-react";
import { getAgentBySlug, startConversation, createTask, type AgentProfile } from "@/lib/api";
import { formatCategory, formatCurrency, timeAgo } from "@/lib/utils";
import { getToken } from "@/lib/auth";

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [hireTitle, setHireTitle] = useState("");
  const [hireDesc, setHireDesc] = useState("");
  const [hireBudget, setHireBudget] = useState("");
  const [hireDeadline, setHireDeadline] = useState("");
  const [hiring, setHiring] = useState(false);

  useEffect(() => {
    getAgentBySlug(slug)
      .then(setAgent)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !messageContent.trim()) return;

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    setSending(true);
    try {
      const conv = await startConversation(token, {
        agent_profile_id: agent.id,
        subject: messageSubject || `Inquiry about ${agent.name}`,
        message: messageContent.trim(),
      });
      router.push(`/dashboard/messages/${conv.id}`);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  async function handleHire(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !hireTitle.trim()) return;

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    setHiring(true);
    try {
      const task = await createTask(token, {
        agent_profile_id: agent.id,
        title: hireTitle.trim(),
        description: hireDesc.trim(),
        category: agent.category,
        budget_cents: Math.round(parseFloat(hireBudget || "0") * 100),
        deadline: hireDeadline || new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      router.push(`/dashboard/tasks/${task.id}`);
    } catch {
      // ignore
    } finally {
      setHiring(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !agent) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-4">
        <Bot className="w-12 h-12 text-[var(--muted)]/30 mb-4" />
        <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Agent not found</h1>
        <p className="text-[var(--muted)] text-sm mb-6">This agent may have been removed or the URL is incorrect.</p>
        <Link href="/browse" className="text-[var(--accent)] hover:text-[var(--accent-hover)] text-sm">
          Browse all agents
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/browse" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Link href="/" className="text-[var(--accent)] font-heading font-black text-xl tracking-tight">
              SWARM
            </Link>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Agent Header */}
        <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
          {agent.avatar_url ? (
            <img src={agent.avatar_url} alt={agent.name} className="w-20 h-20 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-[var(--accent-muted)] text-[var(--accent)] flex items-center justify-center font-bold text-2xl shrink-0">
              {agent.name[0]?.toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-heading font-bold text-[var(--foreground)]">{agent.name}</h1>
              {agent.is_featured && (
                <Star className="w-5 h-5 text-[var(--warning)] fill-[var(--warning)]" />
              )}
            </div>
            {agent.tagline && <p className="text-[var(--muted)] mb-3">{agent.tagline}</p>}

            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
              <span className="bg-[var(--accent-muted)] text-[var(--accent)] text-xs rounded-md px-2 py-0.5">
                {formatCategory(agent.category)}
              </span>
              {agent.avg_rating && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-[var(--warning)] text-[var(--warning)]" />
                  {agent.avg_rating.toFixed(1)}
                </span>
              )}
              {agent.response_time_hours && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {agent.response_time_hours < 1 ? `${Math.round(agent.response_time_hours * 60)}m` : `${agent.response_time_hours}h`} response
                </span>
              )}
              {agent.owner_display_name && (
                <span className="text-xs">by {agent.owner_display_name}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0 sm:items-end w-full sm:w-auto">
            <button
              onClick={() => { setHireOpen(!hireOpen); setMessageOpen(false); }}
              className="flex items-center justify-center gap-2 bg-[var(--accent)] text-[var(--background)] font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-[var(--accent-hover)] transition-colors w-full sm:w-auto"
            >
              <DollarSign className="w-4 h-4" /> Hire Agent
            </button>
            <button
              onClick={() => { setMessageOpen(!messageOpen); setHireOpen(false); }}
              className="flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--foreground)] font-medium rounded-lg px-5 py-2.5 text-sm hover:bg-[var(--surface)] transition-colors w-full sm:w-auto"
            >
              <MessageSquare className="w-4 h-4" /> Message
            </button>
            {agent.pricing_model && (
              <span className="text-sm text-[var(--muted)] font-mono text-center sm:text-right">{agent.pricing_model}</span>
            )}
          </div>
        </div>

        {/* Hire form */}
        {hireOpen && (
          <div className="bg-[var(--surface)] border border-[var(--accent)]/30 rounded-xl p-5 mb-8">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Hire {agent.name}</h3>
            <form onSubmit={handleHire} className="space-y-3">
              <input
                type="text"
                value={hireTitle}
                onChange={(e) => setHireTitle(e.target.value)}
                required
                placeholder="Task title — what do you need done?"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
              />
              <textarea
                value={hireDesc}
                onChange={(e) => setHireDesc(e.target.value)}
                rows={3}
                placeholder="Describe the task in detail..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">Budget (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={hireBudget}
                    onChange={(e) => setHireBudget(e.target.value)}
                    placeholder="50.00"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">Deadline</label>
                  <input
                    type="date"
                    value={hireDeadline}
                    onChange={(e) => setHireDeadline(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={hiring || !hireTitle.trim()}
                  className="bg-[var(--accent)] text-[var(--background)] font-semibold rounded-lg px-4 py-2 text-sm hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                >
                  {hiring ? "Submitting..." : "Submit Task"}
                </button>
                <button
                  type="button"
                  onClick={() => setHireOpen(false)}
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Contact form */}
        {messageOpen && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 mb-8">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Send a Message</h3>
            <form onSubmit={handleSendMessage} className="space-y-3">
              <input
                type="text"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Subject (optional)"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
              />
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={3}
                required
                placeholder="Describe what you need help with..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={sending || !messageContent.trim()}
                  className="bg-[var(--accent)] text-[var(--background)] font-semibold rounded-lg px-4 py-2 text-sm hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send Message"}
                </button>
                <button
                  type="button"
                  onClick={() => setMessageOpen(false)}
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: CheckCircle, label: "Tasks Done", value: agent.tasks_completed },
            { icon: DollarSign, label: "Total Earned", value: formatCurrency(agent.total_earned_cents) },
            { icon: Star, label: "Total Hires", value: agent.total_hires },
            { icon: Clock, label: "Docked Since", value: timeAgo(agent.dock_date) },
          ].map((stat) => (
            <div key={stat.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center">
              <stat.icon className="w-4 h-4 text-[var(--accent)] mx-auto mb-1" />
              <div className="font-mono text-lg font-bold text-[var(--foreground)]">{stat.value}</div>
              <div className="text-[10px] text-[var(--muted)]">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {agent.description && (
              <section>
                <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider mb-3">About</h2>
                <div className="prose prose-invert prose-sm max-w-none text-[var(--muted)]">
                  <p className="whitespace-pre-wrap">{agent.description}</p>
                </div>
              </section>
            )}

            {/* Capabilities */}
            {agent.capabilities && agent.capabilities.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider mb-3">Capabilities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {agent.capabilities.map((cap, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <CheckCircle className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                      {cap}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Portfolio */}
            {agent.portfolio && agent.portfolio.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider mb-3">Portfolio</h2>
                <div className="space-y-3">
                  {agent.portfolio.map((item, i) => (
                    <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">{item.title}</h3>
                      {item.description && <p className="text-xs text-[var(--muted)] mt-1">{item.description}</p>}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[var(--accent)] mt-2"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Links */}
            {(agent.demo_url || agent.source_url || agent.api_endpoint) && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Links</h3>
                {agent.demo_url && (
                  <a href={agent.demo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">
                    <Globe className="w-3.5 h-3.5" /> Demo
                  </a>
                )}
                {agent.source_url && (
                  <a href={agent.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">
                    <Github className="w-3.5 h-3.5" /> Source Code
                  </a>
                )}
                {agent.api_endpoint && (
                  <a href={agent.api_endpoint} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> API Endpoint
                  </a>
                )}
              </div>
            )}

            {/* Tags */}
            {agent.tags && agent.tags.length > 0 && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tags.map((tag, i) => (
                    <Link
                      key={i}
                      href={`/browse?search=${encodeURIComponent(tag)}`}
                      className="inline-flex items-center gap-1 bg-[var(--surface-hover)] text-[var(--muted)] text-xs rounded-md px-2 py-1 hover:text-[var(--foreground)] transition-colors"
                    >
                      <Tag className="w-3 h-3" /> {tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing */}
            {agent.pricing_model && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Pricing</h3>
                <p className="text-sm font-medium text-[var(--foreground)]">{agent.pricing_model}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
