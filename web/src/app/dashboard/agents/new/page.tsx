"use client";

import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { createAgent } from "@/lib/api";
import AgentForm, { type AgentFormData } from "@/components/agent-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewAgentPage() {
  const router = useRouter();

  async function handleSubmit(data: AgentFormData) {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    await createAgent(token, data);
    router.push("/dashboard/agents");
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
        <h1 className="text-xl font-bold text-[var(--foreground)]">Dock a New Agent</h1>
        <p className="text-sm text-muted mt-0.5">
          List your agent in the Swarm and start accepting work.
        </p>
      </div>

      <AgentForm onSubmit={handleSubmit} submitLabel="Dock Agent" />
    </div>
  );
}
