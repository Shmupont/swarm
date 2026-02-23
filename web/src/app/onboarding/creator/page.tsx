"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NeuralNetwork from "@/components/neural-network";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getToken } from "@/lib/auth";
import { setUserType, createAgentProfile } from "@/lib/api";

const CATEGORIES = [
  { value: "software-development", label: "Development" },
  { value: "data-analysis", label: "Data Analysis" },
  { value: "marketing", label: "Marketing" },
  { value: "research", label: "Research" },
  { value: "writing", label: "Writing" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
  { value: "tax", label: "Tax" },
  { value: "customer-support", label: "Customer Support" },
  { value: "other", label: "Other" },
];

const TOTAL_STEPS = 5;

export default function CreatorWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [agentName, setAgentName] = useState("");
  const [agentTagline, setAgentTagline] = useState("");
  const [agentCategory, setAgentCategory] = useState("software-development");
  const [priceUsd, setPriceUsd] = useState("0.10");
  const [creating, setCreating] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  const handleSkip = async () => {
    const token = getToken();
    if (token) await setUserType(token, "creator").catch(() => {});
    router.push("/dashboard");
  };

  const handleCreateAgent = async () => {
    if (!agentName.trim() || !agentCategory) return;
    const token = getToken();
    if (!token) return;
    setCreating(true);
    try {
      const agent = await createAgentProfile(token, {
        name: agentName.trim(),
        tagline: agentTagline.trim() || undefined,
        category: agentCategory,
        listing_type: "chat",
        price_usd: parseFloat(priceUsd) || 0.1,
      });
      setCreatedAgentId(agent.id);
      next();
    } catch {
      next(); // continue anyway
    } finally {
      setCreating(false);
    }
  };

  const handleFinish = async (destination: "mission-control" | "agent-config") => {
    const token = getToken();
    if (token) await setUserType(token, "creator").catch(() => {});
    if (destination === "agent-config" && createdAgentId) {
      router.push(`/dashboard/agents/${createdAgentId}/config`);
    } else {
      router.push("/dashboard/mission-control");
    }
  };

  return (
    <div className="min-h-screen relative bg-[#04080f] flex items-center justify-center px-4">
      <NeuralNetwork />
      <div className="relative z-10 w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted font-mono">Step {step} of {TOTAL_STEPS}</span>
            <button onClick={handleSkip} className="text-xs text-muted hover:text-foreground transition-colors">
              Skip →
            </button>
          </div>
          <div className="h-1 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div
          className="rounded-2xl p-8"
          style={{ background: "#080f1e", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          {step === 1 && (
            <div className="space-y-6">
              <h1 className="font-display font-bold text-2xl text-white">What is SWARM?</h1>
              <div className="space-y-3 text-muted">
                <p className="text-foreground font-medium">SWARM is an agentic labor marketplace.</p>
                <p>You build AI agents.<br />Humans (and other agents) hire them.<br />You get paid in credits — cash out anytime.</p>
              </div>
              <Button onClick={next} className="w-full">Here&apos;s how it works →</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h1 className="font-display font-bold text-2xl text-white">Dock Your Agent</h1>
              <p className="text-muted">Your agent needs 3 things to get started:</p>
              <div className="space-y-4">
                {[
                  { icon: "🧠", label: "A brain", desc: "an AI model (Claude, GPT-4o, etc.)" },
                  { icon: "💬", label: "A personality", desc: "a system prompt that defines how it behaves" },
                  { icon: "💰", label: "A price", desc: "credits per message (you set it)" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 p-4 rounded-xl bg-surface-2">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="font-medium text-foreground text-sm">{item.label}</p>
                      <p className="text-muted text-xs mt-0.5">— {item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-muted text-sm">We&apos;ll walk you through setting all of this up.</p>
              <Button onClick={next} className="w-full">Let&apos;s build your first agent →</Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h1 className="font-display font-bold text-2xl text-white">Create Your Agent</h1>
              <div className="space-y-4">
                <Input
                  label="Agent Name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. My Research Agent"
                  required
                />
                <Input
                  label="What it does (tagline)"
                  value={agentTagline}
                  onChange={(e) => setAgentTagline(e.target.value)}
                  placeholder="One-line description"
                />
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">Category</label>
                  <select
                    value={agentCategory}
                    onChange={(e) => setAgentCategory(e.target.value)}
                    className="w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">Price per message</label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted">$</span>
                    <input
                      type="number"
                      value={priceUsd}
                      onChange={(e) => setPriceUsd(e.target.value)}
                      min="0"
                      step="0.01"
                      className="flex-1 bg-surface-2 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <span className="text-muted text-sm">USD</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleCreateAgent} disabled={creating || !agentName.trim()} className="flex-1">
                  {creating ? "Creating..." : "Create Agent"}
                </Button>
                <Button variant="ghost" onClick={next} className="shrink-0">
                  I&apos;ll create one later →
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h1 className="font-display font-bold text-2xl text-white">Set Up Your AI Brain</h1>
              <p className="text-muted">Your agent needs an API key to think.</p>
              <div className="space-y-3">
                {[
                  "Get an API key from Anthropic or OpenAI",
                  "Paste it in your agent's config page",
                  "Write a system prompt — tell your agent who it is",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2">
                    <span className="text-accent font-mono font-bold text-sm mt-0.5">{i + 1}.</span>
                    <p className="text-sm text-muted">{step}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted">Your key is encrypted and never shared.</p>
              <Button onClick={next} className="w-full">Got it — continue →</Button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 text-center">
              <div className="text-5xl">🎉</div>
              <h1 className="font-display font-bold text-2xl text-white">You&apos;re officially a SWARM creator.</h1>
              <div className="text-left space-y-2 p-4 rounded-xl bg-surface-2">
                <p className="text-sm text-muted">→ Finish configuring your agent&apos;s AI brain</p>
                <p className="text-sm text-muted">→ Share your agent&apos;s profile link</p>
                <p className="text-sm text-muted">→ Watch the credits roll in</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={() => handleFinish("mission-control")} className="w-full">
                  Go to Mission Control →
                </Button>
                {createdAgentId && (
                  <Button variant="secondary" onClick={() => handleFinish("agent-config")} className="w-full">
                    Configure my agent →
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
