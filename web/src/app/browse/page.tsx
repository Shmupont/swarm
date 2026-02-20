"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  Star,
  Bot,
  ArrowLeft,
  X,
} from "lucide-react";
import {
  browseAgents,
  getCategories,
  type AgentProfile,
  type CategoryCount,
} from "@/lib/api";
import { formatCategory, AGENT_CATEGORIES } from "@/lib/utils";

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BrowseContent />
    </Suspense>
  );
}

function BrowseContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "";

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState("");

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const results = await browseAgents({
        category: category || undefined,
        search: search || undefined,
        sort: sort || undefined,
        limit: 50,
      });
      setAgents(results);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [category, search, sort]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(fetchAgents, 300);
    return () => clearTimeout(timer);
  }, [search, fetchAgents]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[var(--accent)] font-heading font-black text-xl tracking-tight">
              SWARM
            </Link>
            <span className="text-[var(--muted)] text-sm hidden sm:block">/</span>
            <span className="text-sm text-[var(--foreground)] hidden sm:block">Marketplace</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-heading font-bold text-[var(--foreground)]">
            {category ? formatCategory(category) : "All Agents"}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} available
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          >
            <option value="">Best Match</option>
            <option value="rating">Highest Rated</option>
            <option value="hires">Most Hired</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCategory("")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              !category
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]"
            }`}
          >
            All
          </button>
          {(categories.length > 0 ? categories : AGENT_CATEGORIES).map((cat) => {
            const slug = "category" in cat ? (cat.category || (cat as any).name || "") : (cat as any).slug;
            const label = "label" in cat ? cat.label : formatCategory(slug);
            return (
              <button
                key={slug}
                onClick={() => setCategory(category === slug ? "" : slug)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  category === slug
                    ? "bg-[var(--accent)] text-[var(--background)]"
                    : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Active filters */}
        {(category || search) && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-[var(--muted)]">Filters:</span>
            {category && (
              <button
                onClick={() => setCategory("")}
                className="inline-flex items-center gap-1 bg-[var(--accent-muted)] text-[var(--accent)] text-xs rounded-md px-2 py-1"
              >
                {formatCategory(category)} <X className="w-3 h-3" />
              </button>
            )}
            {search && (
              <button
                onClick={() => setSearch("")}
                className="inline-flex items-center gap-1 bg-[var(--accent-muted)] text-[var(--accent)] text-xs rounded-md px-2 py-1"
              >
                &quot;{search}&quot; <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-[var(--border)]" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-24 bg-[var(--border)] rounded" />
                    <div className="h-2.5 w-16 bg-[var(--border)] rounded" />
                  </div>
                </div>
                <div className="h-2.5 w-full bg-[var(--border)] rounded mb-2" />
                <div className="h-2.5 w-3/4 bg-[var(--border)] rounded" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16">
            <Bot className="w-12 h-12 text-[var(--muted)]/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No agents found</h3>
            <p className="text-sm text-[var(--muted)]">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link href={`/agents/${agent.slug}`}>
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-hover)] transition-colors h-full">
                    <div className="flex items-center gap-3 mb-3">
                      {agent.avatar_url ? (
                        <img src={agent.avatar_url} alt={agent.name} className="w-11 h-11 rounded-xl object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-[var(--accent-muted)] text-[var(--accent)] flex items-center justify-center font-bold">
                          {agent.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">{agent.name}</h3>
                        <span className="text-xs text-[var(--muted)]">{formatCategory(agent.category)}</span>
                      </div>
                      {agent.is_featured && (
                        <Star className="w-4 h-4 text-[var(--warning)] shrink-0 fill-[var(--warning)]" />
                      )}
                    </div>

                    {agent.tagline && (
                      <p className="text-xs text-[var(--muted)] mb-3 line-clamp-2">{agent.tagline}</p>
                    )}

                    {agent.capabilities && agent.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.capabilities.slice(0, 3).map((cap, j) => (
                          <span key={j} className="bg-[var(--accent-muted)] text-[var(--accent)] text-[10px] rounded-md px-1.5 py-0.5">
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-[10px] text-[var(--muted)] font-mono border-t border-[var(--border)] pt-3">
                      {agent.avg_rating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-[var(--warning)] text-[var(--warning)]" /> {agent.avg_rating.toFixed(1)}
                        </span>
                      )}
                      <span>{agent.total_hires} hires</span>
                      {agent.pricing_model && <span className="ml-auto">{agent.pricing_model}</span>}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
