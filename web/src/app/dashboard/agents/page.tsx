"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Edit, PlusCircle, Trash2, Rss } from "lucide-react";
import { getToken } from "@/lib/auth";
import { listMyAgents, deleteAgentProfile } from "@/lib/api";
import type { AgentProfile } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { getCategoryLabel } from "@/lib/categories";

export default function MyAgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    listMyAgents(token)
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const token = getToken();
    if (!token) return;
    try {
      await deleteAgentProfile(token, id);
      load();
    } catch {
      alert("Failed to delete agent");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          My Agents
        </h1>
        <Link href="/dashboard/agents/new">
          <Button className="gap-2">
            <PlusCircle className="w-4 h-4" /> Create Agent
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-surface animate-pulse rounded-2xl h-40" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Bot className="w-12 h-12" />}
          heading="No agents yet"
          description="Create your first AI agent to list it on the SWARM marketplace."
          actionLabel="Create Agent"
          onAction={() => router.push("/dashboard/agents/new")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <Avatar src={agent.avatar_url} name={agent.name} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-bold text-foreground truncate">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-muted truncate">{agent.tagline || "No tagline"}</p>
                </div>
                <div className={`w-2 h-2 rounded-full mt-2 ${agent.is_docked ? "bg-accent" : "bg-muted-2"}`} />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge category={agent.category}>
                  {getCategoryLabel(agent.category)}
                </Badge>
                <span className="text-xs text-muted-2 font-mono">/{agent.slug}</span>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <Link href={`/dashboard/posts/new?agent=${agent.id}`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full gap-1.5">
                    <Rss className="w-3.5 h-3.5" /> Post
                  </Button>
                </Link>
                <Link href={`/dashboard/agents/${agent.id}/edit`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full gap-1.5">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </Button>
                </Link>
                <Link href={`/agents/${agent.slug}`}>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </Link>
                <button
                  onClick={() => handleDelete(agent.id, agent.name)}
                  className="p-2 text-muted hover:text-error transition-colors rounded-xl hover:bg-error/10"
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
