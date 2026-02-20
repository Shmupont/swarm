"use client";

import { useState, type FormEvent } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import type { AgentProfile, PortfolioItem } from "@/lib/api";
import WebhookConfigSection from "@/components/webhook-config";

const CATEGORIES = [
  "tax", "legal", "finance", "development", "data_analysis",
  "marketing", "research", "writing", "design", "customer_support", "other",
];

interface AgentFormProps {
  initial?: Partial<AgentProfile>;
  agentId?: string; // passed when editing an existing agent
  onSubmit: (data: AgentFormData) => Promise<void>;
  submitLabel: string;
}

export interface AgentFormData {
  name: string;
  tagline: string;
  description: string;
  category: string;
  avatar_url: string;
  tags: string[];
  capabilities: string[];
  pricing_model: string;
  demo_url: string;
  source_url: string;
  api_endpoint: string;
  portfolio: PortfolioItem[];
}

export default function AgentForm({ initial, agentId, onSubmit, submitLabel }: AgentFormProps) {
  const [name, setName] = useState(initial?.name || "");
  const [tagline, setTagline] = useState(initial?.tagline || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [category, setCategory] = useState(initial?.category || "other");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url || "");
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [capabilities, setCapabilities] = useState<string[]>(initial?.capabilities || []);
  const [pricingModel, setPricingModel] = useState(initial?.pricing_model || "");
  const [demoUrl, setDemoUrl] = useState(initial?.demo_url || "");
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url || "");
  const [apiEndpoint, setApiEndpoint] = useState(initial?.api_endpoint || "");
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(initial?.portfolio || []);

  const [tagInput, setTagInput] = useState("");
  const [capInput, setCapInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  }

  function addCapability(e: React.KeyboardEvent) {
    if (e.key === "Enter" && capInput.trim()) {
      e.preventDefault();
      if (!capabilities.includes(capInput.trim())) {
        setCapabilities([...capabilities, capInput.trim()]);
      }
      setCapInput("");
    }
  }

  function addPortfolioItem() {
    setPortfolio([...portfolio, { title: "", description: "", url: "", image_url: "" }]);
  }

  function updatePortfolioItem(index: number, field: keyof PortfolioItem, value: string) {
    const updated = [...portfolio];
    updated[index] = { ...updated[index], [field]: value };
    setPortfolio(updated);
  }

  function removePortfolioItem(index: number) {
    setPortfolio(portfolio.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSubmit({
        name,
        tagline,
        description,
        category,
        avatar_url: avatarUrl,
        tags,
        capabilities,
        pricing_model: pricingModel,
        demo_url: demoUrl,
        source_url: sourceUrl,
        api_endpoint: apiEndpoint,
        portfolio: portfolio.filter((p) => p.title),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "your-agent";

  const inputClass =
    "w-full bg-[var(--bg-secondary)] border border-border rounded-lg px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Section 1: Identity */}
      <section>
        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
          Identity
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className={inputClass}
              placeholder="TaxBot Pro"
            />
            <p className="text-xs text-muted mt-1 font-mono">
              swarm.app/agents/{slug}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={300}
              className={inputClass}
              placeholder="AI-powered tax preparation and advisory"
            />
          </div>

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
            <label className="block text-sm font-medium text-muted mb-1">Avatar URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className={inputClass}
              placeholder="https://example.com/avatar.png"
            />
          </div>
        </div>
      </section>

      {/* Section 2: About */}
      <section>
        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
          About
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className={inputClass}
              placeholder="Describe what your agent does, its strengths, and use cases..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Capabilities <span className="text-muted/60">(press Enter to add)</span>
            </label>
            <input
              type="text"
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              onKeyDown={addCapability}
              className={inputClass}
              placeholder="e.g. Tax filing, W-2 analysis"
            />
            {capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {capabilities.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs rounded-md px-2 py-1"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => setCapabilities(capabilities.filter((_, j) => j !== i))}
                      className="hover:text-accent-hover"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              Tags <span className="text-muted/60">(press Enter to add)</span>
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={addTag}
              className={inputClass}
              placeholder="e.g. automation, finance"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-surface-hover text-muted text-xs rounded-md px-2 py-1"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((_, j) => j !== i))}
                      className="hover:text-[var(--foreground)]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Pricing & Links */}
      <section>
        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
          Pricing & Links
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Pricing Model</label>
            <input
              type="text"
              value={pricingModel}
              onChange={(e) => setPricingModel(e.target.value)}
              className={inputClass}
              placeholder="From $50/task, Contact for pricing, etc."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Demo URL</label>
              <input
                type="url"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                className={inputClass}
                placeholder="https://demo.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Source / GitHub</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className={inputClass}
                placeholder="https://github.com/you/agent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">API Endpoint</label>
            <input
              type="url"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              className={inputClass}
              placeholder="https://api.example.com/v1"
            />
          </div>
        </div>
      </section>

      {/* Section 4: Portfolio */}
      <section>
        <h3 className="text-sm font-semibold text-accent uppercase tracking-wider mb-4">
          Portfolio
        </h3>
        <div className="space-y-4">
          {portfolio.map((item, i) => (
            <div key={i} className="bg-[var(--bg-secondary)] border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted">Example #{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removePortfolioItem(i)}
                  className="text-muted hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updatePortfolioItem(i, "title", e.target.value)}
                className={inputClass}
                placeholder="Project title"
              />
              <input
                type="text"
                value={item.description}
                onChange={(e) => updatePortfolioItem(i, "description", e.target.value)}
                className={inputClass}
                placeholder="Brief description"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="url"
                  value={item.url || ""}
                  onChange={(e) => updatePortfolioItem(i, "url", e.target.value)}
                  className={inputClass}
                  placeholder="URL (optional)"
                />
                <input
                  type="url"
                  value={item.image_url || ""}
                  onChange={(e) => updatePortfolioItem(i, "image_url", e.target.value)}
                  className={inputClass}
                  placeholder="Image URL (optional)"
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addPortfolioItem}
            className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Example Work
          </button>
        </div>
      </section>

      {/* Section 5: Docking Configuration */}
      <WebhookConfigSection agentId={agentId || null} />

      {/* Submit */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={loading || !name.trim() || !category}
          className="flex items-center gap-2 bg-accent text-[var(--background)] font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>

      {/* Live Preview */}
      {name && (
        <section className="border-t border-border pt-6">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Card Preview
          </h3>
          <div className="bg-surface border border-border rounded-xl p-4 max-w-xs">
            <div className="flex items-center gap-3 mb-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-bold text-sm">
                  {name[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-[var(--foreground)]">{name}</h4>
                <span className="text-xs text-muted capitalize">{category.replace(/_/g, " ")}</span>
              </div>
            </div>
            {tagline && <p className="text-xs text-muted mt-1">{tagline}</p>}
            {capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {capabilities.slice(0, 3).map((c, i) => (
                  <span key={i} className="bg-accent/10 text-accent text-[10px] rounded px-1.5 py-0.5">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </form>
  );
}
