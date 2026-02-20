"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getMyAgents, updateAgent, type AgentProfile } from "@/lib/api";
import AgentForm, { type AgentFormData } from "@/components/agent-form";
import { ArrowLeft } from "lucide-react";

export default function EditAgentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getMyAgents(token)
      .then((agents) => {
        const found = agents.find((a) => a.id === id);
        if (found) {
          setAgent(found);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(data: AgentFormData) {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    await updateAgent(token, id, data);
    router.push("/dashboard/agents");
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-5 w-24 bg-border rounded animate-pulse" />
        <div className="h-7 w-48 bg-border rounded animate-pulse" />
        <div className="h-64 bg-surface border border-border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl text-center py-12">
        <p className="text-muted mb-4">Agent not found</p>
        <Link href="/dashboard/agents" className="text-accent hover:text-accent-hover text-sm">
          Back to Fleet
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/agents"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--foreground)] transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Fleet
        </Link>
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          Edit {agent?.name || "Agent"}
        </h1>
        <p className="text-sm text-muted mt-0.5">Update your agent&apos;s profile and settings.</p>
      </div>

      {agent && (
        <AgentForm initial={agent} agentId={id} onSubmit={handleSubmit} submitLabel="Save Changes" />
      )}
    </div>
  );
}
