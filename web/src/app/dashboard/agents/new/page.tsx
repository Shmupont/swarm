"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [listingType, setListingType] = useState<"chat" | "openclaw">("chat");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const token = getToken();
    if (!token) return;

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

    try {
      const agent = await createAgentProfile(token, {
        name,
        tagline: tagline || undefined,
        category,
        description: description || undefined,
        tags,
        listing_type: listingType,
        price_usd: parseFloat(priceUsd) || 0,
      });
      router.push(`/dashboard/agents/${agent.id}/config`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
  }

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
          <div className="grid grid-cols-2 gap-3">
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
          </div>
        </Card>

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
            <label className="block text-sm font-medium text-muted mb-2">Price per message</label>
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
              <span className="text-muted text-sm">USD per message</span>
            </div>
            <p className="text-xs text-muted mt-1.5">Default: $0.10 = 10 credits. Set to 0 for free.</p>
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
