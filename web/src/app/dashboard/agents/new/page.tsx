"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { getToken } from "@/lib/auth";
import { createAgentProfile } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const CATEGORIES = [
  { value: "tax", label: "Tax" },
  { value: "legal", label: "Legal" },
  { value: "finance", label: "Finance" },
  { value: "software-development", label: "Development" },
  { value: "data-analysis", label: "Data Analysis" },
  { value: "marketing", label: "Marketing" },
  { value: "research", label: "Research" },
  { value: "writing", label: "Writing" },
  { value: "design", label: "Design" },
  { value: "customer-support", label: "Customer Support" },
  { value: "sales", label: "Sales" },
  { value: "hr-recruiting", label: "HR & Recruiting" },
  { value: "operations", label: "Operations" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

interface RequiredInput {
  id: string;
  fieldName: string;
  fieldType: "text" | "number" | "dropdown" | "date";
  required: boolean;
}

export default function CreateAgentPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState("software-development");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("0.10");
  const [tagsInput, setTagsInput] = useState("");
  const [listingType, setListingType] = useState<"chat" | "openclaw" | "automation">("chat");

  // Automation-specific state
  const [billingModel, setBillingModel] = useState<"per_run" | "weekly">("per_run");
  const [requiredInputs, setRequiredInputs] = useState<RequiredInput[]>([]);
  const [outputMethods, setOutputMethods] = useState<string[]>(["in_app"]);

  function addRequiredInput() {
    setRequiredInputs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), fieldName: "", fieldType: "text", required: true },
    ]);
  }

  function removeRequiredInput(id: string) {
    setRequiredInputs((prev) => prev.filter((i) => i.id !== id));
  }

  function updateRequiredInput(id: string, patch: Partial<RequiredInput>) {
    setRequiredInputs((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
    );
  }

  function toggleOutputMethod(method: string) {
    setOutputMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const token = getToken();
    if (!token) return;

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

    const payload: Record<string, unknown> = {
      name,
      tagline: tagline || undefined,
      category,
      description: description || undefined,
      tags,
      listing_type: listingType,
      price_usd: parseFloat(priceUsd) || 0,
    };

    if (listingType === "automation") {
      payload.required_inputs_json = JSON.stringify(
        requiredInputs.map(({ fieldName, fieldType, required }) => ({
          field_name: fieldName,
          field_type: fieldType,
          required,
        }))
      );
      payload.output_methods = outputMethods.join(",");
      payload.billing_model = billingModel;
    }

    try {
      const agent = await createAgentProfile(token, payload as Parameters<typeof createAgentProfile>[1]);
      router.push(`/dashboard/agents/${agent.id}/config`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
  }

  const pricingLabel =
    listingType === "automation"
      ? billingModel === "per_run"
        ? "Price per run"
        : "Weekly price"
      : "Price per answer";

  const pricingUnit =
    listingType === "automation"
      ? billingModel === "per_run"
        ? "per run"
        : "per week"
      : "per answer";

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">
        Create Agent
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-error/10 text-error text-sm px-4 py-2.5 rounded-xl">
            {error}
          </div>
        )}

        {/* Listing Type */}
        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Agent Type</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setListingType("chat")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                listingType === "chat"
                  ? "border-accent bg-accent-muted"
                  : "border-surface-2 bg-surface-2 hover:border-muted-2"
              }`}
            >
              <p className="font-heading font-bold text-foreground text-sm">Chat Agent</p>
              <p className="text-xs text-muted mt-1">Users chat via Swarm web UI</p>
            </button>
            <button
              type="button"
              onClick={() => setListingType("openclaw")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                listingType === "openclaw"
                  ? "border-accent bg-accent-muted"
                  : "border-surface-2 bg-surface-2 hover:border-muted-2"
              }`}
            >
              <p className="font-heading font-bold text-foreground text-sm">OpenClaw Agent</p>
              <p className="text-xs text-muted mt-1">Users run your agent locally</p>
            </button>
            <button
              type="button"
              onClick={() => setListingType("automation")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                listingType === "automation"
                  ? "border-accent bg-accent-muted"
                  : "border-surface-2 bg-surface-2 hover:border-muted-2"
              }`}
            >
              <p className="font-heading font-bold text-foreground text-sm">Automation Agent</p>
              <p className="text-xs text-muted mt-1">Runs tasks in the background, no tab required</p>
            </button>
          </div>
        </Card>

        {/* Automation-specific fields */}
        {listingType === "automation" && (
          <>
            {/* Billing Model */}
            <Card className="p-6 space-y-4">
              <h2 className="font-heading font-bold text-foreground">Billing Model</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBillingModel("per_run")}
                  className={`flex-1 py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                    billingModel === "per_run"
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-surface-2 bg-surface-2 text-muted hover:border-muted-2"
                  }`}
                >
                  Per Run
                </button>
                <button
                  type="button"
                  onClick={() => setBillingModel("weekly")}
                  className={`flex-1 py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                    billingModel === "weekly"
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-surface-2 bg-surface-2 text-muted hover:border-muted-2"
                  }`}
                >
                  Weekly
                </button>
              </div>
              <p className="text-xs text-muted">
                {billingModel === "per_run"
                  ? "User is charged once per task execution. Good for one-time searches."
                  : "User is charged weekly. Good for continuous monitoring agents."}
              </p>
            </Card>

            {/* Required Inputs */}
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-heading font-bold text-foreground">Required Inputs</h2>
                <p className="text-xs text-muted mt-1">Define what information users must provide when hiring this agent.</p>
              </div>

              {requiredInputs.length > 0 && (
                <div className="space-y-3">
                  {requiredInputs.map((inp) => (
                    <div key={inp.id} className="flex items-center gap-2 bg-surface-2 rounded-xl p-3">
                      <input
                        type="text"
                        value={inp.fieldName}
                        onChange={(e) => updateRequiredInput(inp.id, { fieldName: e.target.value })}
                        placeholder="e.g. Location, Brand, Budget"
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
                      />
                      <select
                        value={inp.fieldType}
                        onChange={(e) =>
                          updateRequiredInput(inp.id, {
                            fieldType: e.target.value as RequiredInput["fieldType"],
                          })
                        }
                        className="bg-surface rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="date">Date</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={inp.required}
                          onChange={(e) => updateRequiredInput(inp.id, { required: e.target.checked })}
                          className="accent-accent"
                        />
                        Req
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRequiredInput(inp.id)}
                        className="text-muted hover:text-error transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addRequiredInput}
                className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Input
              </button>
            </Card>

            {/* Output Method */}
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-heading font-bold text-foreground">How should results be delivered?</h2>
              </div>
              <div className="space-y-2">
                {[
                  { value: "in_app", label: "In-app notification" },
                  { value: "email", label: "Email to user" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={outputMethods.includes(opt.value)}
                      onChange={() => toggleOutputMethod(opt.value)}
                      className="accent-accent w-4 h-4"
                    />
                    <span className="text-sm text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* Identity */}
        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Identity</h2>
          <Input
            label="Agent Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Research Agent"
            required
          />
          <Input
            label="Tagline — one line description"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="What your agent does in one sentence"
          />
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Description <span className="text-muted-2 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Tell users what your agent does..."
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
            />
          </div>
        </Card>

        {/* Pricing */}
        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Pricing</h2>
          <div>
            <label className="block text-sm font-medium text-muted mb-2">{pricingLabel}</label>
            <div className="flex items-center gap-2">
              <span className="text-muted font-medium">$</span>
              <input
                type="number"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0.10"
                className="flex-1 bg-surface-2 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <span className="text-muted text-sm">{pricingUnit}</span>
            </div>
            <p className="text-xs text-muted mt-1.5">Default: $0.10 per answer. Set to 0 for free.</p>
          </div>
        </Card>

        {/* Tags */}
        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Tags</h2>
          <Input
            label="Tags (comma-separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. research, analysis, reports"
          />
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Creating..." : "Create Agent"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
