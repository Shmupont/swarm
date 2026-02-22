"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Network, ExternalLink } from "lucide-react";
import { NavBar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  skills: { id: string; name: string; description: string }[];
  swarm_meta: {
    agent_id: string;
    slug: string;
    category: string;
    is_docked: boolean;
    status: string;
  };
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle} className="text-muted hover:text-accent transition-colors shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function A2APage() {
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/a2a/registry`)
      .then((r) => r.json())
      .then(setAgents)
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const agentCardUrl = (agentId: string) =>
    `${API_URL}/a2a/agents/${agentId}/agent.json`;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1 pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-5">
              <Network className="w-7 h-7 text-accent" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-3">A2A Registry</h1>
            <p className="text-muted text-base max-w-xl mx-auto mb-3">
              SWARM is compatible with Google&apos;s Agent-to-Agent protocol. Every docked agent
              exposes a standard Agent Card that any A2A-compatible system can discover and call.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium">
              <Network className="w-4 h-4" />
              A2A Compatible
            </div>
          </div>

          {/* What is A2A */}
          <Card className="p-6 mb-8">
            <h2 className="font-heading text-lg font-bold text-foreground mb-2">What is A2A?</h2>
            <p className="text-sm text-muted leading-relaxed">
              A2A (Agent-to-Agent) is Google&apos;s open standard for agent interoperability,
              enabling AI agents from different platforms to discover, communicate, and delegate
              tasks to each other using a unified protocol. Each agent publishes an{" "}
              <span className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded text-foreground">
                agent.json
              </span>{" "}
              descriptor — its Agent Card — that describes capabilities, skills, and API endpoints.
            </p>
            <div className="mt-4 bg-surface-2 rounded-xl p-4 font-mono text-xs text-muted overflow-x-auto">
              <div className="text-muted-2 mb-2"># Discover all SWARM agents</div>
              <div>
                GET{" "}
                <span className="text-accent">{API_URL}/a2a/registry</span>
              </div>
              <div className="mt-1 text-muted-2 mb-2"># Get a specific agent card</div>
              <div>
                GET{" "}
                <span className="text-accent">{API_URL}/a2a/agents/&#123;agent_id&#125;/agent.json</span>
              </div>
              <div className="mt-1 text-muted-2 mb-2"># Submit a task</div>
              <div>
                POST{" "}
                <span className="text-accent">{API_URL}/a2a/agents/&#123;agent_id&#125;/tasks</span>
              </div>
            </div>
          </Card>

          {/* Agent list */}
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground mb-4">
              Active Agents ({loading ? "…" : agents.length})
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-5">
                    <div className="flex items-start gap-3">
                      <Skeleton className="w-10 h-10 rounded-squircle shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <Card className="p-10 text-center">
                <Network className="w-10 h-10 text-muted-2 mx-auto mb-3" />
                <h3 className="font-heading font-bold text-foreground mb-2">No agents yet</h3>
                <p className="text-sm text-muted">
                  Dock an agent to make it discoverable in the A2A ecosystem.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <Card key={agent.swarm_meta.agent_id} className="p-5">
                    <div className="flex items-start gap-4">
                      <a href={`/agents/${agent.swarm_meta.slug}`} className="shrink-0">
                        <Avatar src={null} name={agent.name} size="md" />
                      </a>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <a
                                href={`/agents/${agent.swarm_meta.slug}`}
                                className="font-medium text-foreground hover:text-accent transition-colors"
                              >
                                {agent.name}
                              </a>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                                A2A Compatible
                              </span>
                            </div>
                            <p className="text-sm text-muted mt-0.5 line-clamp-2">
                              {agent.description}
                            </p>
                          </div>
                          <a
                            href={`/agents/${agent.swarm_meta.slug}`}
                            className="text-muted hover:text-accent transition-colors shrink-0 mt-0.5"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>

                        {/* Skills */}
                        {agent.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {agent.skills.slice(0, 5).map((s) => (
                              <span
                                key={s.id}
                                className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-muted"
                              >
                                {s.name}
                              </span>
                            ))}
                            {agent.skills.length > 5 && (
                              <span className="text-xs text-muted-2">
                                +{agent.skills.length - 5} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Agent Card URL */}
                        <div className="flex items-center gap-2 mt-3 bg-surface-2 rounded-lg px-3 py-2">
                          <code className="text-xs font-mono text-muted flex-1 truncate">
                            {agentCardUrl(agent.swarm_meta.agent_id)}
                          </code>
                          <CopyButton value={agentCardUrl(agent.swarm_meta.agent_id)} />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
