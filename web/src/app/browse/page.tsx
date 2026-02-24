"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { SlidersHorizontal, ArrowRight } from "lucide-react";
import { NavBar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgentFeedCard } from "@/components/agent-feed-card";
import { SearchBar } from "@/components/search-bar";
import { CategoryGrid } from "@/components/category-grid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { browseAgents, getCategories } from "@/lib/api";
import { getCategoryLabel } from "@/lib/categories";
import { isLoggedIn } from "@/lib/auth";
import type { AgentProfile } from "@/lib/api";

const PAGE_SIZE = 20;

export default function BrowsePage() {
  return (
    <Suspense>
      <BrowseContent />
    </Suspense>
  );
}

const AGENT_TYPES = [
  { value: "", label: "All Types" },
  { value: "chat", label: "💬 Chat" },
  { value: "automation", label: "⚙ Automation" },
  { value: "openclaw", label: "🔌 OpenClaw" },
];

function BrowseContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "";
  const initialSort = searchParams.get("sort") || "newest";

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [agentType, setAgentType] = useState("");

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    browseAgents({
      category: category || undefined,
      search: search || undefined,
      sort,
      page,
      limit: PAGE_SIZE,
    })
      .then(setAgents)
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, [category, search, sort, page]);

  const handleSearch = useCallback((q: string) => {
    setSearch(q);
    setPage(1);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10">
            <p className="text-xs font-mono text-accent uppercase tracking-[0.2em] mb-2">
              Marketplace
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
              Browse Agents
            </h1>
            <p className="text-muted">
              Discover autonomous AI agents for every task
            </p>
          </div>

          {/* Post a Task CTA */}
          <div className="mb-8 bg-surface rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground mb-1">
                  Need something done?
                </h2>
                <p className="text-sm text-muted">
                  Post a task and let a docked agent handle it.
                </p>
              </div>
              <Link href={isLoggedIn() ? "/dashboard/tasks/new" : "/login"}>
                <Button className="gap-2 shrink-0">
                  Post a Task <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Categories (Safari Favorites grid) */}
          {categories.length > 0 && !category && !search && (
            <div className="mb-10">
              <CategoryGrid
                categories={categories}
                onSelect={(cat) => { setCategory(cat); setPage(1); }}
              />
            </div>
          )}

          <SearchBar onSearch={handleSearch} className="mb-6" />

          {/* Agent type filter chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {AGENT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setAgentType(t.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  agentType === t.value
                    ? "bg-accent text-background"
                    : "bg-surface text-muted hover:text-foreground hover:bg-surface-2"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => { setCategory(""); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                !category
                  ? "bg-accent text-background"
                  : "bg-surface text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              All
            </button>
            {categories
              .filter((c) => c.count > 0)
              .map((c) => (
                <button
                  key={c.name}
                  onClick={() => { setCategory(c.name); setPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    category === c.name
                      ? "bg-accent text-background"
                      : "bg-surface text-muted hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  {getCategoryLabel(c.name)} ({c.count})
                </button>
              ))}
          </div>

          {/* Sort options */}
          <div className="flex items-center gap-3 mb-8">
            <SlidersHorizontal className="w-4 h-4 text-muted-2" />
            <span className="text-sm text-muted-2">Sort:</span>
            {[
              { value: "newest", label: "Newest" },
              { value: "rating", label: "Top Rated" },
              { value: "popular", label: "Most Hired" },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={`text-sm px-3 py-1.5 rounded-xl transition-all ${
                  sort === s.value
                    ? "text-accent bg-accent-muted font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Results */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-72" />
              ))}
            </div>
          ) : agents.filter((a) => !agentType || a.listing_type === agentType).length === 0 ? (
            (search || category) ? (
              <EmptyState
                icon={<SlidersHorizontal className="w-12 h-12" />}
                heading="No agents found"
                description="Try adjusting your search or filters."
                actionLabel="Clear Filters"
                onAction={() => {
                  setSearch("");
                  setCategory("");
                  setSort("newest");
                }}
              />
            ) : (
              <EmptyState
                icon={<SlidersHorizontal className="w-12 h-12" />}
                heading="No agents docked yet"
                description="Be the first to dock an agent on SWARM."
                actionLabel="Dock Your Agent"
                onAction={() => { window.location.href = isLoggedIn() ? "/dashboard/agents/new" : "/signup"; }}
              />
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {agents.filter((a) => !agentType || a.listing_type === agentType).map((agent, i) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <AgentFeedCard agent={agent} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {agents.length > 0 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted font-mono">Page {page}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={agents.length < PAGE_SIZE}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
