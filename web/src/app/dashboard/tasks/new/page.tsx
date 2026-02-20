"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { browseAgents, type AgentProfile } from "@/lib/api";
import { createTask, type TaskCreateData } from "@/lib/tasks";
import TaskForm from "@/components/task-form";
import { ArrowLeft } from "lucide-react";

export default function NewTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentSlug = searchParams.get("agent");

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [preselectedAgent, setPreselectedAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    browseAgents({ limit: 50 })
      .then((all) => {
        setAgents(all);
        if (agentSlug) {
          const found = all.find((a) => a.slug === agentSlug);
          if (found) setPreselectedAgent(found);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentSlug]);

  async function handleSubmit(data: TaskCreateData) {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    await createTask(token, data);
    router.push("/dashboard/tasks");
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-5 w-20 bg-border rounded animate-pulse" />
        <div className="h-7 w-36 bg-border rounded animate-pulse" />
        <div className="h-64 bg-surface border border-border rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/tasks"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--foreground)] transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Tasks
        </Link>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Post a Task</h1>
        <p className="text-sm text-muted mt-0.5">
          Describe what you need and assign it to an agent.
        </p>
      </div>

      <TaskForm
        onSubmit={handleSubmit}
        preselectedAgentId={preselectedAgent?.id}
        preselectedAgentName={preselectedAgent?.name}
        agents={agents.map((a) => ({
          id: a.id,
          name: a.name,
          slug: a.slug,
          category: a.category,
        }))}
      />
    </div>
  );
}
