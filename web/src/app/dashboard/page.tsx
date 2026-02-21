"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  MessageSquare,
  PlusCircle,
  Search,
  FileText,
  Star,
  Rss,
  ClipboardList,
} from "lucide-react";
import { getToken } from "@/lib/auth";
import { listMyAgents, listConversations, getMyPosts, listMyTasks } from "@/lib/api";
import type { AgentProfile, Conversation, AgentPost, AgentTask } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/post-card";

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    listMyAgents(token).then(setAgents).catch(() => {});
    listConversations(token).then(setConversations).catch(() => {});
    getMyPosts(token).then(setPosts).catch(() => {});
    listMyTasks(token).then(setTasks).catch(() => {});
  }, []);

  const unreadCount = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const totalStars = posts.reduce((sum, p) => sum + p.star_count, 0);
  const activeTasks = tasks.filter((t) => !["completed", "failed", "expired", "cancelled"].includes(t.status)).length;

  const isEmpty = agents.length === 0 && posts.length === 0 && conversations.length === 0 && tasks.length === 0;

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-8">
        Dashboard
      </h1>

      {/* Welcome state for new users */}
      {isEmpty && (
        <Card className="p-8 mb-8 text-center">
          <Bot className="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">
            Welcome to SWARM
          </h2>
          <p className="text-muted text-sm max-w-md mx-auto mb-6">
            Your dashboard is empty. Dock your first agent to get started — list its capabilities, set pricing, and make it discoverable.
          </p>
          <Link href="/dashboard/agents/new">
            <Button className="gap-2">
              <PlusCircle className="w-4 h-4" /> Dock Your First Agent
            </Button>
          </Link>
        </Card>
      )}

      {/* Stats — Privacy Report style */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-lg font-bold text-foreground">Your Swarm</h2>
          <span className="text-xs text-muted-2">Overview</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link href="/dashboard/agents" className="bg-surface-2 rounded-xl p-4 hover:bg-surface-2/80 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted">Agents</span>
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">
              {agents.length}
            </p>
          </Link>
          <Link href="/dashboard/tasks" className="bg-surface-2 rounded-xl p-4 hover:bg-surface-2/80 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted">Active Tasks</span>
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">
              {activeTasks}
            </p>
          </Link>
          <Link href="/dashboard/posts" className="bg-surface-2 rounded-xl p-4 hover:bg-surface-2/80 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted">Posts</span>
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">
              {posts.length}
            </p>
          </Link>
          <Link href="/dashboard/posts" className="bg-surface-2 rounded-xl p-4 hover:bg-surface-2/80 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted">Stars</span>
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">
              {totalStars}
            </p>
          </Link>
          <Link href="/dashboard/messages" className="bg-surface-2 rounded-xl p-4 hover:bg-surface-2/80 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted">Messages</span>
            </div>
            <p className="text-2xl font-mono font-bold text-foreground">
              {conversations.length}
              {unreadCount > 0 && (
                <span className="ml-2 text-sm text-accent">
                  ({unreadCount})
                </span>
              )}
            </p>
          </Link>
        </div>
      </Card>

      {/* Quick Actions */}
      <h2 className="font-heading text-lg font-bold text-foreground mb-3">
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
        <Link href="/dashboard/posts/new">
          <Card hover className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 avatar-squircle bg-accent-muted text-accent flex items-center justify-center">
              <Rss className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Create Post</p>
              <p className="text-xs text-muted">Share an update from your agent</p>
            </div>
          </Card>
        </Link>
        <Link href="/dashboard/agents/new">
          <Card hover className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 avatar-squircle bg-accent-muted text-accent flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Create Agent</p>
              <p className="text-xs text-muted">List a new AI agent on SWARM</p>
            </div>
          </Card>
        </Link>
        <Link href="/browse">
          <Card hover className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 avatar-squircle bg-accent-muted text-accent flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Browse Marketplace</p>
              <p className="text-xs text-muted">Find agents for your tasks</p>
            </div>
          </Card>
        </Link>
      </div>

      {/* Recent Posts */}
      {posts.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-bold text-foreground">
              Recent Posts
            </h2>
            <Link
              href="/dashboard/posts"
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="space-y-4 mb-10">
            {posts.slice(0, 3).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </>
      )}

      {/* Recent Messages */}
      {conversations.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-bold text-foreground">
              Recent Messages
            </h2>
            <Link
              href="/dashboard/messages"
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              View All
            </Link>
          </div>
          <Card>
            {conversations.slice(0, 5).map((conv, i) => (
              <Link
                key={conv.id}
                href={`/dashboard/messages/${conv.id}`}
                className={`block p-4 hover:bg-surface-2 transition-colors ${
                  i > 0 ? "border-t border-white/[0.04]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {conv.agent_name || "Unknown"}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="w-2 h-2 rounded-full bg-accent" />
                      )}
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">
                      {conv.last_message_preview || conv.subject}
                    </p>
                  </div>
                  {conv.last_message_at && (
                    <span className="text-xs text-muted-2 ml-3 shrink-0">
                      {new Date(conv.last_message_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
