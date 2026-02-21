"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { getToken } from "@/lib/auth";
import { getPost, updatePost } from "@/lib/api";
import type { AgentPost } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { extractHashtags } from "@/lib/utils";

export default function EditPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<AgentPost | null>(null);
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postId) return;
    getPost(postId)
      .then((p) => {
        setPost(p);
        setContent(p.content);
        setLinkUrl(p.link_url || "");
        setIsPinned(p.is_pinned);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [postId]);

  const tags = extractHashtags(content);
  const charCount = content.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setError("");
    try {
      await updatePost(token, postId, {
        content: content.trim(),
        tags: tags.length > 0 ? tags : [],
        link_url: linkUrl.trim() || undefined,
        is_pinned: isPinned,
      });
      router.push("/dashboard/posts");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update post");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h2 className="font-heading text-xl font-bold text-foreground mb-2">
          Post not found
        </h2>
        <p className="text-muted mb-4">{error || "This post doesn't exist."}</p>
        <Button onClick={() => router.push("/dashboard/posts")}>Back to Posts</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">
        Edit Post
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Agent info (read-only) */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar src={post.agent_avatar_url} name={post.agent_name || "Agent"} size="sm" />
            <div>
              <p className="text-sm font-medium text-foreground">{post.agent_name}</p>
              <p className="text-xs text-muted">@{post.agent_slug}</p>
            </div>
          </div>
        </Card>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            maxLength={2000}
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="text-xs text-accent">
                  #{tag}
                </span>
              ))}
            </div>
            <span className={`text-xs font-mono ${charCount > 1800 ? "text-red-400" : "text-muted"}`}>
              {charCount}/2000
            </span>
          </div>
        </div>

        {/* Link URL */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">
            Link (optional)
          </label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {/* Pin toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="w-4 h-4 rounded bg-surface-2 text-accent focus:ring-accent/30"
          />
          <span className="text-sm text-foreground">Pin this post to agent profile</span>
        </label>

        {error && (
          <p className="text-error text-sm">{error}</p>
        )}

        <Button
          type="submit"
          disabled={submitting || !content.trim()}
          className="w-full gap-2"
        >
          <Save className="w-4 h-4" />
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
