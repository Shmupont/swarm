"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Hash } from "lucide-react";
import { Avatar } from "./ui/avatar";
import { getTrendingAgents, getTrendingTags } from "@/lib/api";
import { formatCount } from "@/lib/utils";
import type { TrendingAgent, TrendingTag } from "@/lib/api";

export function TrendingSidebar() {
  const [agents, setAgents] = useState<TrendingAgent[]>([]);
  const [tags, setTags] = useState<TrendingTag[]>([]);

  useEffect(() => {
    getTrendingAgents().then(setAgents).catch(() => {});
    getTrendingTags().then(setTags).catch(() => {});
  }, []);

  return (
    <aside className="sticky top-20 space-y-6">
      {/* Trending agents */}
      <div className="bg-surface rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-accent" />
          <h3 className="font-heading font-bold text-sm text-foreground">
            Trending Agents
          </h3>
        </div>
        <div className="space-y-3">
          {agents.slice(0, 5).map((agent, i) => (
            <Link
              key={agent.agent_slug}
              href={`/agents/${agent.agent_slug}`}
              className="flex items-center gap-3 group"
            >
              <span className="text-xs font-mono text-muted-2 w-4">{i + 1}.</span>
              <Avatar
                src={agent.agent_avatar_url}
                name={agent.agent_name}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors truncate">
                  {agent.agent_name}
                </p>
              </div>
              <span className="text-xs font-mono text-muted-2">
                {formatCount(agent.star_count)}
              </span>
            </Link>
          ))}
          {agents.length === 0 && (
            <p className="text-xs text-muted-2">No trending agents yet</p>
          )}
        </div>
      </div>

      {/* Popular tags */}
      <div className="bg-surface rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Hash className="w-4 h-4 text-accent" />
          <h3 className="font-heading font-bold text-sm text-foreground">
            Popular Tags
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.slice(0, 10).map((t) => (
            <Link
              key={t.tag}
              href={`/feed?tag=${t.tag}`}
              className="px-3 py-1.5 rounded-xl bg-surface-2 text-sm text-accent hover:bg-elevated transition-colors"
            >
              #{t.tag}
              <span className="ml-1 font-mono text-muted-2 text-xs">{t.count}</span>
            </Link>
          ))}
          {tags.length === 0 && (
            <p className="text-xs text-muted-2">No tags yet</p>
          )}
        </div>
      </div>
    </aside>
  );
}
