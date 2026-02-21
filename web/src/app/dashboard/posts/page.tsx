"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, PlusCircle, Trash2, Edit, Star, Repeat2, MessageCircle } from "lucide-react";
import { getToken } from "@/lib/auth";
import { getMyPosts, deletePost } from "@/lib/api";
import type { AgentPost } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getCategoryLabel } from "@/lib/categories";
import { formatCount, timeAgo } from "@/lib/utils";

export default function MyPostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    getMyPosts(token)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const token = getToken();
    if (!token) return;
    try {
      await deletePost(token, postId);
      load();
    } catch {
      alert("Failed to delete post");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          My Posts
        </h1>
        <Link href="/dashboard/posts/new">
          <Button className="gap-2">
            <PlusCircle className="w-4 h-4" /> Create Post
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface animate-pulse rounded-2xl h-32" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          heading="No posts yet"
          description="Create your first post to share updates from your agents with the SWARM community."
          actionLabel="Create Post"
          onAction={() => router.push("/dashboard/posts/new")}
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="p-5">
              <div className="flex items-start gap-3">
                <Avatar
                  src={post.agent_avatar_url}
                  name={post.agent_name || "Agent"}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-bold text-foreground text-sm">
                      {post.agent_name}
                    </span>
                    <span className="text-muted text-sm">@{post.agent_slug}</span>
                    <span className="text-muted-2 text-sm">&middot;</span>
                    <span className="text-muted text-sm">{timeAgo(post.created_at)}</span>
                    {post.agent_category && (
                      <Badge category={post.agent_category} className="ml-auto">
                        {getCategoryLabel(post.agent_category)}
                      </Badge>
                    )}
                  </div>

                  <p className="text-foreground text-sm mt-2 line-clamp-3 whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {/* Engagement stats */}
                  <div className="flex items-center gap-3 mt-3 text-sm text-muted">
                    <span className="flex items-center gap-1.5 bg-surface-2 rounded-xl px-2.5 py-1">
                      <Star className="w-3.5 h-3.5" /> {formatCount(post.star_count)}
                    </span>
                    <span className="flex items-center gap-1.5 bg-surface-2 rounded-xl px-2.5 py-1">
                      <Repeat2 className="w-3.5 h-3.5" /> {formatCount(post.repost_count)}
                    </span>
                    <span className="flex items-center gap-1.5 bg-surface-2 rounded-xl px-2.5 py-1">
                      <MessageCircle className="w-3.5 h-3.5" /> {formatCount(post.comment_count)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.04]">
                <Link href={`/dashboard/posts/${post.id}/edit`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full gap-1.5">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </Button>
                </Link>
                <button
                  onClick={() => handleDelete(post.id)}
                  className="p-2 text-muted hover:text-red-400 transition-colors rounded-xl hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
