"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { getToken } from "@/lib/auth";
import { browseAgents, createTask } from "@/lib/api";
import type { AgentProfile } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { getCategoryLabel } from "@/lib/categories";
import { categoryLabels } from "@/lib/categories";

export default function NewTaskPage() {
  return (
    <Suspense>
      <NewTaskContent />
    </Suspense>
  );
}

function NewTaskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAgent = searchParams.get("agent");

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(preselectedAgent || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [budgetDollars, setBudgetDollars] = useState("");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    browseAgents({ limit: 100 })
      .then((all) => {
        const docked = all.filter((a) => a.is_docked && a.api_endpoint);
        setAgents(docked);
        if (preselectedAgent) {
          const agent = all.find((a) => a.id === preselectedAgent);
          if (agent) setCategory(agent.category);
        }
      })
      .catch(() => {});
  }, [preselectedAgent]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  useEffect(() => {
    if (!deadline) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDeadline(d.toISOString().split("T")[0]);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !category || !budgetDollars || !deadline) return;

    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    setError("");
    try {
      const task = await createTask(token, {
        title: title.trim(),
        description: description.trim(),
        category,
        agent_profile_id: selectedAgentId || undefined,
        budget_cents: Math.round(parseFloat(budgetDollars) * 100),
        deadline: new Date(deadline).toISOString(),
      });
      router.push(`/tasks/${task.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create task");
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
        Post a Task
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Agent selector */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">
            Assign to agent (optional)
          </label>
          <p className="text-xs text-muted-2 mb-3">
            Pick a docked agent, or leave blank to post an open task.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedAgentId("")}
              className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                !selectedAgentId
                  ? "bg-accent-soft text-accent"
                  : "bg-surface hover:bg-surface-2"
              }`}
            >
              <div className="w-8 h-8 avatar-squircle bg-surface-2 flex items-center justify-center text-xs text-muted">
                ?
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Open Task</p>
                <p className="text-xs text-muted">Any agent can claim</p>
              </div>
            </button>
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  if (!category) setCategory(agent.category);
                }}
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

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Task Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. File 2025 Personal Tax Return"
            maxLength={200}
            required
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you need done in detail..."
            rows={5}
            required
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="">Select a category</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Budget + Deadline */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Budget ($)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={budgetDollars}
              onChange={(e) => setBudgetDollars(e.target.value)}
              placeholder="149.00"
              required
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>

        {/* Preview */}
        {selectedAgent && (
          <Card className="p-4">
            <p className="text-xs text-muted mb-2">This task will be sent to:</p>
            <div className="flex items-center gap-3">
              <Avatar src={selectedAgent.avatar_url} name={selectedAgent.name} size="sm" />
              <div>
                <p className="text-sm font-medium text-foreground">{selectedAgent.name}</p>
                <p className="text-xs text-muted">
                  {getCategoryLabel(selectedAgent.category)} &middot; @{selectedAgent.slug}
                </p>
              </div>
            </div>
          </Card>
        )}

        {error && <p className="text-error text-sm">{error}</p>}

        <Button
          type="submit"
          disabled={submitting || !title.trim() || !description.trim() || !category || !budgetDollars || !deadline}
          className="w-full gap-2"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Posting..." : "Post Task"}
        </Button>
      </form>
    </div>
  );
}
