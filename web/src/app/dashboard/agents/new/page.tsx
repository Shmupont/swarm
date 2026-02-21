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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [capsInput, setCapsInput] = useState("");
  const [pricingModel, setPricingModel] = useState("");
  const [pricingInput, setPricingInput] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");

  // OpenClaw
  const [listingType, setListingType] = useState<"chat" | "openclaw">("chat");
  const [openclawRepoUrl, setOpenclawRepoUrl] = useState("");
  const [openclawInstructions, setOpenclawInstructions] = useState("");
  const [openclawVersion, setOpenclawVersion] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const token = getToken();
    if (!token) return;

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const capabilities = capsInput.split(",").map((t) => t.trim()).filter(Boolean);

    let pricing_details: Record<string, number> = {};
    if (pricingInput.trim()) {
      try {
        pricing_details = JSON.parse(pricingInput);
      } catch {
        pricing_details = {};
      }
    }

    try {
      await createAgentProfile(token, {
        name,
        tagline,
        category,
        description,
        avatar_url: avatarUrl || undefined,
        tags,
        capabilities,
        pricing_model: pricingModel || undefined,
        pricing_details,
        demo_url: demoUrl || undefined,
        source_url: sourceUrl || undefined,
        api_endpoint: apiEndpoint || undefined,
        listing_type: listingType,
        openclaw_repo_url: openclawRepoUrl || undefined,
        openclaw_install_instructions: openclawInstructions || undefined,
        openclaw_version: openclawVersion || undefined,
      });
      router.push("/dashboard/agents");
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
              <p className="text-xs text-muted mt-1">Users chat with your agent via the Swarm web UI</p>
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
              <p className="text-xs text-muted mt-1">Users run your agent locally, LLM calls route through Swarm</p>
            </button>
          </div>
        </Card>

        {listingType === "openclaw" && (
          <Card className="p-6 space-y-4">
            <h2 className="font-heading font-bold text-foreground">OpenClaw Configuration</h2>
            <Input label="Repository URL" value={openclawRepoUrl} onChange={(e) => setOpenclawRepoUrl(e.target.value)} placeholder="https://github.com/you/your-agent" />
            <Input label="Version" value={openclawVersion} onChange={(e) => setOpenclawVersion(e.target.value)} placeholder="1.0.0" />
            <div>
              <label className="block text-sm font-medium text-muted mb-2">Install Instructions</label>
              <textarea
                value={openclawInstructions}
                onChange={(e) => setOpenclawInstructions(e.target.value)}
                rows={4}
                placeholder={"pip install your-agent\nyour-agent init"}
                className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y font-mono text-sm"
              />
            </div>
          </Card>
        )}

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Identity</h2>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Agent" required />
          <Input label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A short description of what your agent does" />
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
          <Input label="Avatar URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Description</h2>
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Full Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe your agent's capabilities, features, and use cases..."
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Tags & Capabilities</h2>
          <Input label="Tags (comma-separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. tax-prep, filing, compliance" />
          <Input label="Capabilities (comma-separated)" value={capsInput} onChange={(e) => setCapsInput(e.target.value)} placeholder="e.g. Document Parsing, Tax Calculation" />
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Pricing</h2>
          <Input label="Pricing Model" value={pricingModel} onChange={(e) => setPricingModel(e.target.value)} placeholder="e.g. per-task, monthly, hourly" />
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Pricing Details (JSON)</label>
            <textarea
              value={pricingInput}
              onChange={(e) => setPricingInput(e.target.value)}
              rows={3}
              placeholder='e.g. {"basic": 49, "pro": 149}'
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground font-mono text-sm placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Links</h2>
          <Input label="Demo URL" value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://..." />
          <Input label="Source Code URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://github.com/..." />
          <Input label="API Endpoint" value={apiEndpoint} onChange={(e) => setApiEndpoint(e.target.value)} placeholder="https://api...." />
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Publishing..." : "Publish Agent"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
