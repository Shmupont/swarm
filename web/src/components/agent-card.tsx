"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Star, Zap, Clock, MessageSquare, Plug, Settings2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Avatar } from "./ui/avatar";
import { getCategoryLabel } from "@/lib/categories";
import type { AgentProfile } from "@/lib/api";

export function AgentCard({ agent }: { agent: AgentProfile }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-surface rounded-2xl p-5 transition-colors duration-200 hover:bg-card-hover flex flex-col"
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar src={agent.avatar_url} name={agent.name} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-foreground truncate">
            {agent.name}
          </h3>
          <p className="text-muted text-sm truncate">{agent.tagline}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Badge category={agent.category}>
          {getCategoryLabel(agent.category)}
        </Badge>
        {agent.listing_type === "automation" ? (
          <Badge variant="tag" className="text-muted flex items-center gap-1">
            <Settings2 className="w-3 h-3" /> Automation
          </Badge>
        ) : agent.listing_type === "openclaw" ? (
          <Badge variant="tag" className="text-muted flex items-center gap-1">
            <Plug className="w-3 h-3" /> OpenClaw
          </Badge>
        ) : (
          <Badge variant="tag" className="text-muted flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Chat
          </Badge>
        )}
        {agent.is_featured && (
          <Badge variant="tag" className="text-accent">
            Featured
          </Badge>
        )}
      </div>

      {agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {agent.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs text-muted bg-surface-2 px-2 py-0.5 rounded-xl"
            >
              {tag}
            </span>
          ))}
          {agent.tags.length > 3 && (
            <span className="text-xs text-muted-2">+{agent.tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 mt-auto pt-3 text-sm">
        {agent.avg_rating != null && (
          <div className="flex items-center gap-1 text-muted">
            <Star className="w-3.5 h-3.5 text-accent" />
            <span className="font-mono">{agent.avg_rating.toFixed(1)}</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-muted">
          <Zap className="w-3.5 h-3.5" />
          <span className="font-mono">{agent.total_hires}</span>
          <span>hires</span>
        </div>
        {agent.response_time_hours != null && (
          <div className="flex items-center gap-1 text-muted">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono">
              {agent.response_time_hours < 1
                ? `${Math.round(agent.response_time_hours * 60)}m`
                : `${agent.response_time_hours}h`}
            </span>
          </div>
        )}
      </div>

      <Link
        href={`/agents/${agent.slug}`}
        className="mt-3 block text-center text-sm font-medium text-accent hover:text-accent-hover transition-colors"
      >
        View Profile
      </Link>
    </motion.div>
  );
}
