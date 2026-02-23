"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Settings, Loader2, Check } from "lucide-react";
import { getToken } from "@/lib/auth";
import { getAgentConfig, updateAgentConfig, listMyAgents } from "@/lib/api";
import type { AgentConfig, AgentProfile } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Recommended)" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
];

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (Recommended)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
];

export default function AgentConfigPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [priceCredits, setPriceCredits] = useState(0);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [openaiAssistantId, setOpenaiAssistantId] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    Promise.all([
      listMyAgents(token).then((agents) => agents.find((a) => a.id === id) || null),
      getAgentConfig(id, token).catch(() => null),
    ])
      .then(([foundAgent, foundConfig]) => {
        setAgent(foundAgent);
        if (foundConfig) {
          setConfig(foundConfig);
          setPriceCredits(foundConfig.price_per_message_credits);
          setProvider(foundConfig.llm_provider || "anthropic");
          setModel(foundConfig.llm_model || "claude-sonnet-4-20250514");
          setSystemPrompt(foundConfig.system_prompt || "");
          setWelcomeMessage(foundConfig.welcome_message || "");
          setOpenaiAssistantId(foundConfig.openai_assistant_id || "");
        }
      })
      .catch(() => setError("Failed to load agent config"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider === "anthropic") {
      setModel("claude-sonnet-4-20250514");
    } else {
      setModel("gpt-4o");
    }
  };

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload: Parameters<typeof updateAgentConfig>[1] = {
        system_prompt: systemPrompt,
        welcome_message: welcomeMessage,
        llm_model: model,
        llm_provider: provider,
        price_per_message_credits: priceCredits,
        openai_assistant_id: openaiAssistantId.trim() || null,
      };
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      const updated = await updateAgentConfig(id, payload, token);
      setConfig(updated);
      setApiKey("");
      setShowApiKeyInput(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  const currentModels = provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-2xl">
        <p className="text-muted">Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.push(`/dashboard/agents/${id}/edit`)}
        className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Edit
      </button>

      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-6 h-6 text-accent" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {agent.name} — AI Configuration
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Configure the LLM brain powering your agent&apos;s responses
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {error && (
          <div className="bg-error/10 text-error text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Pricing */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-heading font-bold text-foreground">Pricing</h2>
            <p className="text-sm text-muted mt-1">Set how much users pay per message</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">
              Credits per message
            </label>
            <input
              type="number"
              min={0}
              value={priceCredits}
              onChange={(e) => setPriceCredits(parseInt(e.target.value) || 0)}
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm"
            />
            <p className="text-xs text-muted mt-1.5">
              {priceCredits === 0 ? "Free for all users" : `Users pay ${priceCredits} credits per message`}
            </p>
          </div>
        </Card>

        {/* AI Model */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-heading font-bold text-foreground">
              AI Model
              {openaiAssistantId.trim() && (
                <span className="ml-2 text-xs font-normal text-muted">
                  (overridden by Assistant)
                </span>
              )}
            </h2>
            <p className="text-sm text-muted mt-1">Choose the LLM powering your agent</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {currentModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* API Key */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-heading font-bold text-foreground">API Key</h2>
            <p className="text-sm text-muted mt-1">
              Encrypted at rest. Never shared. Powers your agent&apos;s responses.
            </p>
          </div>
          {config?.has_api_key && !showApiKeyInput ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-sm text-muted font-mono">
                  ●●●●●●●● (configured)
                  {config.api_key_preview && (
                    <span className="ml-2 text-foreground">{config.api_key_preview}</span>
                  )}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKeyInput(true)}
              >
                Update key
              </Button>
            </div>
          ) : (
            <div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
                className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm font-mono"
              />
              {config?.has_api_key && (
                <button
                  type="button"
                  onClick={() => { setShowApiKeyInput(false); setApiKey(""); }}
                  className="text-xs text-muted hover:text-foreground mt-2 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </Card>

        {/* OpenAI Assistant ID */}
        <Card className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-heading font-bold text-foreground">
                OpenAI Assistant ID{" "}
                <span className="text-muted font-normal text-sm">(Optional)</span>
              </h2>
              <p className="text-sm text-muted mt-1">
                Have a Custom GPT or OpenAI Assistant? Paste its ID here and SWARM will route
                chats through the Assistants API — preserving your knowledge files, retrieval,
                and custom instructions.
              </p>
            </div>
            {config?.openai_assistant_id && (
              <span className="shrink-0 ml-4 text-xs font-medium bg-accent/15 text-accent px-2.5 py-1 rounded-full">
                ✓ Connected
              </span>
            )}
          </div>
          <div>
            <input
              type="text"
              value={openaiAssistantId}
              onChange={(e) => setOpenaiAssistantId(e.target.value)}
              placeholder="asst_xxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 text-sm font-mono"
            />
            <p className="text-xs text-muted mt-1.5">
              Find your Assistant ID at{" "}
              <span className="text-foreground font-mono">platform.openai.com/assistants</span>.
              When set, the system prompt and model below are overridden by the Assistant&apos;s
              own instructions.
            </p>
          </div>
        </Card>

        {/* System Prompt */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-heading font-bold text-foreground">
              System Prompt
              {openaiAssistantId.trim() && (
                <span className="ml-2 text-xs font-normal text-muted">
                  (overridden by Assistant)
                </span>
              )}
            </h2>
            <p className="text-sm text-muted mt-1">
              This shapes your agent&apos;s entire personality and behavior.
            </p>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            placeholder={`You are ${agent.name}, an expert in...\nDescribe your personality, expertise, and how you respond to users.`}
            className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-y text-sm"
          />
        </Card>

        {/* Welcome Message */}
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-heading font-bold text-foreground">Welcome Message</h2>
            <p className="text-sm text-muted mt-1">
              First message users see when they open a chat.
            </p>
          </div>
          <Input
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder={`Hey! I'm ${agent.name}. How can I help you today?`}
          />
        </Card>

        <Button
          type="submit"
          disabled={saving}
          className="w-full gap-2"
          size="lg"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : saved ? (
            <><Check className="w-4 h-4" /> Configuration Saved!</>
          ) : (
            "SAVE CONFIGURATION"
          )}
        </Button>
      </form>
    </div>
  );
}
