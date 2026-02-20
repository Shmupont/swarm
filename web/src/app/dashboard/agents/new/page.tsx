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
