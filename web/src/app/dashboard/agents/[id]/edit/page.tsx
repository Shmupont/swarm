"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  listMyAgents,
  updateAgentProfile,
  configureAgentBrain,
  setAgentApiKey,
  deleteAgentApiKey,
  getAgentBrainStatus,
} from "@/lib/api";
import type { AgentProfile, BrainStatus } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function EditAgentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [capsInput, setCapsInput] = useState("");
  const [pricingModel, setPricingModel] = useState("");
  const [pricingInput, setPricingInput] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [isDocked, setIsDocked] = useState(true);

  // Brain config
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [llmModel, setLlmModel] = useState("claude-sonnet-4-20250514");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [brainSaving, setBrainSaving] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [brainMessage, setBrainMessage] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    listMyAgents(token)
      .then((agents) => {
        const found = agents.find((a) => a.id === id);
        if (!found) {
          setError("Agent not found");
          return;
        }
        setAgent(found);
        setName(found.name);
        setTagline(found.tagline || "");
        setCategory(found.category);
        setDescription(found.description);
        setAvatarUrl(found.avatar_url || "");
        setTagsInput(found.tags.join(", "));
        setCapsInput(found.capabilities.join(", "));
        setPricingModel(found.pricing_model || "");
        setPricingInput(
          Object.keys(found.pricing_details).length
            ? JSON.stringify(found.pricing_details, null, 2)
            : ""
        );
        setDemoUrl(found.demo_url || "");
        setSourceUrl(found.source_url || "");
        setApiEndpoint(found.api_endpoint || "");
        setIsDocked(found.is_docked);
      })
      .catch(() => setError("Failed to load agent"))
      .finally(() => setLoading(false));

    // Load brain status
    getAgentBrainStatus(token, id)
      .then((status) => {
        setBrainStatus(status);
        setLlmModel(status.model);
        setTemperature(status.temperature);
        setMaxTokens(status.max_tokens);
        if (status.system_prompt) {
          setSystemPrompt(status.system_prompt);
        }
      })
      .catch(() => {});
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
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
      await updateAgentProfile(token, id, {
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
        is_docked: isDocked,
      });
      router.push("/dashboard/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update agent");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">
        Edit Agent
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-error/10 text-error text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Identity</h2>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <Input label="Avatar URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted">Docked</label>
            <button
              type="button"
              onClick={() => setIsDocked(!isDocked)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isDocked ? "bg-accent" : "bg-surface-2"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isDocked ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Description</h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
          />
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Tags & Capabilities</h2>
          <Input label="Tags (comma-separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          <Input label="Capabilities (comma-separated)" value={capsInput} onChange={(e) => setCapsInput(e.target.value)} />
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Pricing</h2>
          <Input label="Pricing Model" value={pricingModel} onChange={(e) => setPricingModel(e.target.value)} />
          <textarea
            value={pricingInput}
            onChange={(e) => setPricingInput(e.target.value)}
            rows={3}
            placeholder='{"basic": 49, "pro": 149}'
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground font-mono text-sm placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y"
          />
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-heading font-bold text-foreground">Links</h2>
          <Input label="Demo URL" value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} />
          <Input label="Source Code URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          <Input label="API Endpoint" value={apiEndpoint} onChange={(e) => setApiEndpoint(e.target.value)} />
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Agent Brain Config — outside main form */}
      <div className="mt-8 space-y-6">
        <h2 className="font-heading text-xl font-bold text-foreground">
          Agent Brain (Chat Configuration)
        </h2>

        {brainStatus && (
          <div className="flex items-center gap-3 text-sm">
            <div className={`w-2.5 h-2.5 rounded-full ${brainStatus.is_chat_ready ? "bg-accent" : "bg-muted-2"}`} />
            <span className="text-muted">
              {brainStatus.is_chat_ready
                ? "Chat is live — users can talk to this agent"
                : "Chat not ready — configure system prompt and API key below"}
            </span>
          </div>
        )}

        <Card className="p-6 space-y-4">
          <h3 className="font-heading font-bold text-foreground">System Prompt</h3>
          <p className="text-sm text-muted">
            Define your agent&apos;s personality and behavior. This is the instruction set that powers every conversation.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            placeholder="You are a helpful tax advisor agent. You specialize in..."
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y text-sm"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Model</label>
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                <option value="claude-opus-4-6">Claude Opus 4.6</option>
              </select>
            </div>
            <Input
              label="Temperature"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
            />
            <Input
              label="Max Tokens"
              type="number"
              min={100}
              max={4096}
              step={100}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
            />
          </div>

          <Button
            type="button"
            disabled={brainSaving || !systemPrompt.trim()}
            onClick={async () => {
              const token = getToken();
              if (!token) return;
              setBrainSaving(true);
              setBrainMessage("");
              try {
                await configureAgentBrain(token, id, {
                  system_prompt: systemPrompt,
                  llm_model: llmModel,
                  temperature,
                  max_tokens: maxTokens,
                });
                setBrainMessage("Brain config saved!");
                const status = await getAgentBrainStatus(token, id);
                setBrainStatus(status);
              } catch (err) {
                setBrainMessage(err instanceof Error ? err.message : "Failed to save");
              } finally {
                setBrainSaving(false);
              }
            }}
          >
            {brainSaving ? "Saving..." : "Save Brain Config"}
          </Button>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-heading font-bold text-foreground">API Key</h3>
          <p className="text-sm text-muted">
            Your Anthropic API key is encrypted at rest and only used when users chat with this agent.
          </p>
          {brainStatus?.has_api_key && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-muted">Key configured: <code className="font-mono text-foreground">{brainStatus.api_key_preview}</code></span>
            </div>
          )}
          <div className="flex gap-3">
            <Input
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              className="font-mono text-sm"
            />
            <Button
              type="button"
              disabled={keySaving || !apiKeyInput.trim()}
              onClick={async () => {
                const token = getToken();
                if (!token) return;
                setKeySaving(true);
                setBrainMessage("");
                try {
                  const result = await setAgentApiKey(token, id, apiKeyInput);
                  setApiKeyInput("");
                  setBrainMessage("API key saved!");
                  const status = await getAgentBrainStatus(token, id);
                  setBrainStatus(status);
                } catch (err) {
                  setBrainMessage(err instanceof Error ? err.message : "Failed to save key");
                } finally {
                  setKeySaving(false);
                }
              }}
              className="shrink-0"
            >
              {keySaving ? "Saving..." : "Save Key"}
            </Button>
          </div>
          {brainStatus?.has_api_key && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                const token = getToken();
                if (!token) return;
                try {
                  await deleteAgentApiKey(token, id);
                  setBrainMessage("API key removed");
                  const status = await getAgentBrainStatus(token, id);
                  setBrainStatus(status);
                } catch (err) {
                  setBrainMessage(err instanceof Error ? err.message : "Failed");
                }
              }}
              className="text-error"
            >
              Remove API Key
            </Button>
          )}
        </Card>

        {brainMessage && (
          <div className="bg-accent-muted text-accent text-sm px-4 py-3 rounded-xl">
            {brainMessage}
          </div>
        )}
      </div>
    </div>
  );
}
