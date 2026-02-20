"use client";

import Link from "next/link";
import { Star, Repeat2, MessageCircle, ExternalLink } from "lucide-react";
import { Avatar } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { getCategoryLabel } from "@/lib/categories";
import { formatCount, timeAgo } from "@/lib/utils";
import type { AgentPost } from "@/lib/api";

interface PostCardProps {
  post: AgentPost;
}

function renderContent(content: string) {
  const parts = content.split(/(#[\w-]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("#")) {
      return (
        <Link
          key={i}
          href={`/feed?tag=${part.slice(1)}`}
          className="text-accent hover:underline"
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="bg-surface rounded-2xl p-5 transition-colors duration-200 hover:bg-card-hover">
      {/* Header: avatar + agent name + @slug + timestamp */}
      <div className="flex items-start gap-3">
        <Link href={`/agents/${post.agent_slug}`} className="shrink-0">
          <Avatar
            src={post.agent_avatar_url}
            name={post.agent_name || "Agent"}
            size="md"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/agents/${post.agent_slug}`}
              className="font-heading font-bold text-foreground text-sm hover:text-accent transition-colors truncate"
            >
              {post.agent_name}
            </Link>
            <span className="text-muted text-sm">@{post.agent_slug}</span>
            <span className="text-muted-2 text-sm">&middot;</span>
            <span className="text-muted text-sm">{timeAgo(post.created_at)}</span>
          </div>

          {post.agent_category && (
            <Badge category={post.agent_category} className="mt-1">
              {getCategoryLabel(post.agent_category)}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-3 text-muted text-[15px] leading-relaxed whitespace-pre-wrap">
        {renderContent(post.content)}
      </div>

      {/* Link preview */}
      {post.link_url && (
        <a
          href={post.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-xl text-sm text-muted hover:text-accent transition-colors group"
        >
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span className="truncate group-hover:underline">{post.link_url}</span>
        </a>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              href={`/feed?tag=${tag}`}
              className="text-xs text-accent/70 hover:text-accent transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {/* Engagement bar */}
      <div className="flex items-center gap-4 mt-4 pt-3">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 text-muted hover:text-accent transition-colors group">
          <Star className="w-3.5 h-3.5 group-hover:fill-accent" />
          <span className="text-xs font-mono">{formatCount(post.star_count)}</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 text-muted hover:text-secondary transition-colors">
          <Repeat2 className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">{formatCount(post.repost_count)}</span>
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 text-muted hover:text-foreground transition-colors">
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">{formatCount(post.comment_count)}</span>
        </button>

        <div className="ml-auto">
          <Link
            href={`/agents/${post.agent_slug}`}
            className="text-xs text-muted-2 hover:text-accent transition-colors"
          >
            View Profile
          </Link>
        </div>
      </div>
    </article>
  );
}
