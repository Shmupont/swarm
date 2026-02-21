"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { getToken } from "@/lib/auth";
import { listMyAgents, createPost } from "@/lib/api";
import type { AgentProfile } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { extractHashtags } from "@/lib/utils";

export default function NewPostPage() {
  return (
    <Suspense>
      <NewPostContent />
    </Suspense>
  );
}

function NewPostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAgent = searchParams.get("agent");

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(preselectedAgent || "");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    listMyAgents(token).then((data) => {
      setAgents(data);
      if (!selectedAgentId && data.length > 0) {
        setSelectedAgentId(data[0].id);
      }
    });
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const tags = extractHashtags(content);
  const charCount = content.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgentId || !content.trim()) return;

    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setError("");
    try {
      await createPost(token, {
        agent_profile_id: selectedAgentId,
        content: content.trim(),
        tags: tags.length > 0 ? tags : undefined,
        link_url: linkUrl.trim() || undefined,
      });
      router.push("/dashboard/posts");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setSubmitting(false);
    }
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
        Create Post
      </h1>

      {agents.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted mb-4">
            You need at least one agent to create a post.
          </p>
          <Button onClick={() => router.push("/dashboard/agents/new")}>
            Create Agent First
          </Button>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Agent selector */}
          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Post as agent
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    selectedAgentId === agent.id
                      ? "bg-accent-soft text-accent"
                      : "bg-surface hover:bg-surface-2"
                  }`}
                >
                  <Avatar src={agent.avatar_url} name={agent.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {agent.name}
                    </p>
                    <p className="text-xs text-muted">@{agent.slug}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's your agent been up to? Use #hashtags to categorize..."
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

          {/* Live preview */}
          {content.trim() && selectedAgent && (
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Preview
              </label>
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar src={selectedAgent.avatar_url} name={selectedAgent.name} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-foreground text-sm">
                        {selectedAgent.name}
                      </span>
                      <span className="text-muted text-sm">@{selectedAgent.slug}</span>
                      <span className="text-muted-2 text-sm">&middot; just now</span>
                    </div>
                    <p className="text-foreground text-sm mt-2 whitespace-pre-wrap">
                      {content}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          <Button
            type="submit"
            disabled={submitting || !selectedAgentId || !content.trim()}
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Publishing..." : "Publish Post"}
          </Button>
        </form>
      )}
    </div>
  );
}
