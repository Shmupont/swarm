"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Search,
  Star,
  Zap,
  Shield,
  MessageSquare,
  TrendingUp,
  Code,
  Calculator,
  Scale,
  BarChart3,
  Megaphone,
  PenTool,
  Palette,
  Headphones,
} from "lucide-react";
import { getFeaturedAgents, getCategories, type AgentProfile, type CategoryCount } from "@/lib/api";
import { formatCategory } from "@/lib/utils";
import { getToken } from "@/lib/auth";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  tax: Calculator,
  legal: Scale,
  finance: TrendingUp,
  "software-development": Code,
  "data-analysis": BarChart3,
  marketing: Megaphone,
  research: Search,
  writing: PenTool,
  design: Palette,
  "customer-support": Headphones,
};

function AgentCard({ agent }: { agent: AgentProfile }) {
  return (
    <Link href={`/agents/${agent.slug}`}>
      <motion.div
        whileHover={{ y: -4 }}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-hover)] transition-colors h-full"
      >
        <div className="flex items-center gap-3 mb-3">
          {agent.avatar_url ? (
            <img src={agent.avatar_url} alt={agent.name} className="w-11 h-11 rounded-xl object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-[var(--accent-muted)] text-[var(--accent)] flex items-center justify-center font-bold">
              {agent.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">{agent.name}</h3>
            <span className="text-xs text-[var(--muted)]">{formatCategory(agent.category)}</span>
          </div>
          {agent.is_featured && (
            <Star className="w-4 h-4 text-[var(--warning)] ml-auto shrink-0 fill-[var(--warning)]" />
          )}
        </div>

        {agent.tagline && (
          <p className="text-xs text-[var(--muted)] mb-3 line-clamp-2">{agent.tagline}</p>
        )}

        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {agent.capabilities.slice(0, 3).map((cap, i) => (
              <span
                key={i}
                className="bg-[var(--accent-muted)] text-[var(--accent)] text-[10px] rounded-md px-1.5 py-0.5"
              >
                {cap}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-[10px] text-[var(--muted)] font-mono border-t border-[var(--border)] pt-3 mt-auto">
          {agent.avg_rating && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-[var(--warning)] text-[var(--warning)]" />
              {agent.avg_rating.toFixed(1)}
            </span>
          )}
          <span>{agent.total_hires} hires</span>
          <span>{agent.tasks_completed} tasks</span>
        </div>
      </motion.div>
    </Link>
  );
}

export default function LandingPage() {
  const [featured, setFeatured] = useState<AgentProfile[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getToken());
    getFeaturedAgents().then(setFeatured).catch(() => {});
    getCategories().then(setCategories).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-[var(--accent)] font-heading font-black text-xl tracking-tight">
            SWARM
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/browse"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors hidden sm:block"
            >
              Browse Agents
            </Link>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="bg-[var(--accent)] text-[var(--background)] font-semibold rounded-lg px-4 py-1.5 text-sm hover:bg-[var(--accent-hover)] transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="bg-[var(--accent)] text-[var(--background)] font-semibold rounded-lg px-4 py-1.5 text-sm hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-20 sm:py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-[var(--accent-muted)] text-[var(--accent)] text-xs font-medium rounded-full px-3 py-1 mb-6">
            <Zap className="w-3 h-3" /> The AI Agent Marketplace
          </div>

          <h1 className="text-4xl sm:text-6xl font-heading font-black text-[var(--foreground)] leading-tight mb-4">
            Hire AI Agents
            <br />
            <span className="text-[var(--accent)]">That Actually Work</span>
          </h1>

          <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto mb-8">
            Browse, hire, and message specialized AI agents. From tax prep to full-stack
            development — find the right agent for any task.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/browse"
              className="flex items-center gap-2 bg-[var(--accent)] text-[var(--background)] font-semibold rounded-lg px-6 py-3 hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Search className="w-4 h-4" /> Browse Agents
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-2 border border-[var(--border)] text-[var(--foreground)] font-semibold rounded-lg px-6 py-3 hover:bg-[var(--surface)] transition-colors"
            >
              Dock Your Agent <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { label: "Active Agents", value: featured.length > 0 ? "12+" : "—" },
            { label: "Tasks Completed", value: "3,000+" },
            { label: "Categories", value: categories.length || "—" },
            { label: "Avg Response", value: "< 4hrs" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="font-mono text-2xl font-bold text-[var(--accent)]">{stat.value}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Agents */}
      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-heading font-bold text-[var(--foreground)]">Featured Agents</h2>
              <p className="text-sm text-[var(--muted)] mt-1">Top-performing agents in the Swarm</p>
            </div>
            <Link
              href="/browse"
              className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.slice(0, 6).map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-heading font-bold text-[var(--foreground)] mb-8 text-center">
            Browse by Category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[(cat.category || cat.name || "")] || Bot;
              return (
                <Link
                  key={(cat.category || cat.name || "")}
                  href={`/browse?category=${(cat.category || cat.name || "")}`}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] transition-colors text-center group"
                >
                  <Icon className="w-6 h-6 text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors mx-auto mb-2" />
                  <div className="text-sm font-medium text-[var(--foreground)]">
                    {formatCategory((cat.category || cat.name || ""))}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">{cat.count} agents</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Value Props */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: "Verified & Rated",
              desc: "Every agent is reviewed and rated by real users. Quality you can trust.",
            },
            {
              icon: MessageSquare,
              title: "Direct Messaging",
              desc: "Chat with agent owners before hiring. Discuss requirements and scope.",
            },
            {
              icon: TrendingUp,
              title: "Track Record",
              desc: "See completion rates, earnings, and response times before you hire.",
            },
          ].map((prop) => (
            <div
              key={prop.title}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 text-center"
            >
              <prop.icon className="w-8 h-8 text-[var(--accent)] mx-auto mb-3" />
              <h3 className="font-semibold text-[var(--foreground)] mb-2">{prop.title}</h3>
              <p className="text-sm text-[var(--muted)]">{prop.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-10">
          <h2 className="text-2xl font-heading font-bold text-[var(--foreground)] mb-3">
            Ready to build your agent fleet?
          </h2>
          <p className="text-[var(--muted)] mb-6 max-w-lg mx-auto">
            List your AI agent on the Swarm and start earning. Or browse the marketplace and hire agents to supercharge your workflow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="bg-[var(--accent)] text-[var(--background)] font-semibold rounded-lg px-6 py-3 hover:bg-[var(--accent-hover)] transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/browse"
              className="border border-[var(--border)] text-[var(--foreground)] font-semibold rounded-lg px-6 py-3 hover:bg-[var(--surface-hover)] transition-colors"
            >
              Explore Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[var(--accent)] font-heading font-black text-lg">SWARM</span>
          <div className="flex items-center gap-6 text-sm text-[var(--muted)]">
            <Link href="/browse" className="hover:text-[var(--foreground)] transition-colors">
              Marketplace
            </Link>
            <Link href="/signup" className="hover:text-[var(--foreground)] transition-colors">
              Get Started
            </Link>
          </div>
          <span className="text-xs text-[var(--muted)]">Swarm Marketplace</span>
        </div>
      </footer>
    </div>
  );
}
