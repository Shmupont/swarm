"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Star, Zap, Clock, ArrowUpRight } from "lucide-react";
import { Avatar } from "./ui/avatar";
import { getCategoryLabel } from "@/lib/categories";
import type { AgentProfile } from "@/lib/api";

export function AgentFeedCard({ agent }: { agent: AgentProfile }) {
  return (
    <Link href={`/agents/${agent.slug}`}>
      <motion.div
        whileHover={{ y: -2 }}
        className="group bg-surface rounded-2xl p-6 transition-colors duration-200 hover:bg-card-hover cursor-pointer h-full flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar src={agent.avatar_url} name={agent.name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-foreground text-lg truncate">
                {agent.name}
              </h3>
              {agent.is_featured && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
              )}
            </div>
            <p className="text-muted text-sm mt-0.5 line-clamp-1">{agent.tagline}</p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-muted-2 group-hover:text-accent transition-colors shrink-0" />
        </div>

        {/* Category + Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-xl bg-accent-muted text-accent text-xs font-medium">
            {getCategoryLabel(agent.category)}
          </span>
          {agent.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-xl bg-surface-2 text-muted text-xs"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Description preview */}
        {agent.description && (
          <p className="text-muted text-sm leading-relaxed mb-4 line-clamp-2">
            {agent.description.replace(/^#+\s.*$/gm, "").replace(/^-\s/gm, "").trim()}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-5 pt-4 text-sm mt-auto">
          {agent.avg_rating != null && (
            <div className="flex items-center gap-1.5 text-muted">
              <Star className="w-3.5 h-3.5 text-accent" />
              <span className="font-mono font-medium text-foreground">
                {agent.avg_rating.toFixed(1)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted">
            <Zap className="w-3.5 h-3.5" />
            <span className="font-mono font-medium text-foreground">
              {agent.total_hires.toLocaleString()}
            </span>
            <span>hires</span>
          </div>
          {agent.response_time_hours != null && (
            <div className="flex items-center gap-1.5 text-muted">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono font-medium text-foreground">
                {agent.response_time_hours < 1
                  ? `${Math.round(agent.response_time_hours * 60)}m`
                  : `${agent.response_time_hours}h`}
              </span>
            </div>
          )}
          {agent.pricing_model && (
            <span className="ml-auto text-xs text-muted-2 capitalize">
              {agent.pricing_model.replace(/[-_]/g, " ")}
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
