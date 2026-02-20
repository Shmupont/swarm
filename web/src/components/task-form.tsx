"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import type { TaskCreateData } from "@/lib/tasks";

const CATEGORIES = [
  "tax", "legal", "finance", "development", "data_analysis",
  "marketing", "research", "writing", "design", "customer_support", "other",
];

const EXECUTION_TIMES = [
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "1 hour", value: 60 },
  { label: "6 hours", value: 360 },
  { label: "24 hours", value: 1440 },
  { label: "48 hours", value: 2880 },
];

const OUTPUT_FORMATS = ["json", "text", "file_url", "markdown"];

interface TaskFormProps {
  onSubmit: (data: TaskCreateData) => Promise<void>;
  preselectedAgentId?: string;
  preselectedAgentName?: string;
  agents?: Array<{ id: string; name: string; slug: string; category: string }>;
}

const inputClass =
  "w-full bg-[var(--bg-secondary)] border border-border rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors";

export default function TaskForm({ onSubmit, preselectedAgentId, preselectedAgentName, agents }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [budgetDollars, setBudgetDollars] = useState("");
  const [deadline, setDeadline] = useState("");
  const [maxExecMinutes, setMaxExecMinutes] = useState(60);
  const [outputFormat, setOutputFormat] = useState("json");
  const [taskInputsRaw, setTaskInputsRaw] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState(preselectedAgentId || "");
  const [assignMode, setAssignMode] = useState<"agent" | "open">(preselectedAgentId ? "agent" : "open");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const budgetCents = Math.round(parseFloat(budgetDollars || "0") * 100);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (budgetCents <= 0) {
      setError("Budget must be greater than $0");
      return;
    }

    let taskInputs: Record<string, unknown> | undefined;
    if (taskInputsRaw.trim()) {
      try {
        taskInputs = JSON.parse(taskInputsRaw);
      } catch {
        setError("Task Inputs must be valid JSON");
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        budget_cents: budgetCents,
        deadline: deadline || undefined,
        max_execution_minutes: maxExecMinutes,
        output_format: outputFormat,
        task_inputs: taskInputs,
        assigned_agent_id: assignMode === "agent" && assignedAgentId ? assignedAgentId : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Assign to */}
      <div>
        <label className="block text-sm font-medium text-muted mb-2">Assign to</label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setAssignMode("agent")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              assignMode === "agent"
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-surface border border-border text-muted hover:text-[var(--foreground)]"
            }`}
          >
            Specific Agent
          </button>
          <button
            type="button"
            onClick={() => setAssignMode("open")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              assignMode === "open"
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-surface border border-border text-muted hover:text-[var(--foreground)]"
            }`}
          >
            Open to Category
          </button>
        </div>

        {assignMode === "agent" && (
          <div>
            {preselectedAgentName ? (
              <div className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-2 text-sm text-accent">
                {preselectedAgentName}
              </div>
            ) : agents && agents.length > 0 ? (
              <select
                value={assignedAgentId}
                onChange={(e) => setAssignedAgentId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select an agent...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.category.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted">No agents available. Browse the marketplace to find one.</p>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-muted mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
          placeholder="File 2025 Personal Tax Return"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-muted mb-1">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
          className={inputClass}
          placeholder="Describe what you need done in detail..."
        />
      </div>

      {/* Task Inputs */}
      <div>
        <label className="block text-sm font-medium text-muted mb-1">
          Task Inputs <span className="text-muted/50">(JSON, optional)</span>
        </label>
        <textarea
          value={taskInputsRaw}
          onChange={(e) => setTaskInputsRaw(e.target.value)}
          rows={3}
          className={`${inputClass} font-mono text-xs`}
          placeholder='{ "tax_year": 2025, "filing_status": "single" }'
        />
      </div>

      {/* Row: Category + Budget */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ").replace(/^\w/, (ch) => ch.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Budget *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={budgetDollars}
              onChange={(e) => setBudgetDollars(e.target.value)}
              required
              className={`${inputClass} pl-7`}
              placeholder="50.00"
            />
          </div>
        </div>
      </div>

      {/* Row: Deadline + Max Execution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Deadline</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Max execution time</label>
          <select
            value={maxExecMinutes}
            onChange={(e) => setMaxExecMinutes(Number(e.target.value))}
            className={inputClass}
          >
            {EXECUTION_TIMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Output format */}
      <div>
        <label className="block text-sm font-medium text-muted mb-2">Output format</label>
        <div className="flex gap-2">
          {OUTPUT_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setOutputFormat(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                outputFormat === f
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-surface border border-border text-muted hover:text-[var(--foreground)]"
              }`}
            >
              {f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="pt-4 border-t border-border">
        <button
          type="submit"
          disabled={loading || !title.trim() || budgetCents <= 0}
          className="flex items-center gap-2 bg-accent text-[var(--background)] font-semibold rounded-lg px-6 py-3 text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Post Task — ${(budgetCents / 100).toFixed(2)}
        </button>
      </div>
    </form>
  );
}
