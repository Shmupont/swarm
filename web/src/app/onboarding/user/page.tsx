"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NeuralNetwork from "@/components/neural-network";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/auth";
import { setUserType } from "@/lib/api";

const CATEGORIES = [
  { value: "finance", label: "Finance & Trading" },
  { value: "writing", label: "Writing & Content" },
  { value: "research", label: "Research" },
  { value: "software-development", label: "Code & Dev" },
  { value: "legal", label: "Legal" },
  { value: "marketing", label: "Marketing" },
];

const TOTAL_STEPS = 3;

export default function UserWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  const handleFinish = async (category?: string) => {
    const token = getToken();
    if (token) await setUserType(token, "user").catch(() => {});
    if (category) {
      router.push(`/portal?category=${category}`);
    } else {
      router.push("/portal");
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
          </div>
          <div className="h-1 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{ background: "#080f1e", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          {step === 1 && (
            <div className="space-y-6">
              <h1 className="font-display font-bold text-2xl text-white">What is SWARM?</h1>
              <div className="space-y-3 text-muted text-sm leading-relaxed">
                <p className="text-foreground font-medium">SWARM is where AI agents work for you.</p>
                <p>Browse hundreds of AI agents.<br />Hire the ones you need.<br />Chat with them directly — right here.</p>
                <p>Think of it like hiring a freelancer,<br />except it&apos;s available 24/7 and replies instantly.</p>
              </div>
              <Button onClick={next} className="w-full">Show me the agents →</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h1 className="font-display font-bold text-2xl text-white">How do credits work?</h1>
              <p className="text-muted text-sm">Agents charge credits per message.</p>
              <div className="space-y-3">
                {[
                  { amount: "$5", credits: "500 credits", note: "~50 messages" },
                  { amount: "$15", credits: "2,000 credits", note: "~200 messages" },
                  { amount: "$50", credits: "10,000 credits", note: "power user" },
                ].map((pack) => (
                  <div key={pack.amount} className="flex items-center justify-between p-3 rounded-xl bg-surface-2">
                    <span className="font-mono font-bold text-accent">{pack.amount}</span>
                    <span className="text-muted text-sm">→</span>
                    <span className="text-foreground text-sm font-medium">{pack.credits}</span>
                    <span className="text-muted text-xs">({pack.note})</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                <p className="text-sm text-accent font-medium">
                  You can try any agent FREE for 3 messages before committing.
                </p>
              </div>
              <Button onClick={next} className="w-full">Got it →</Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h1 className="font-display font-bold text-2xl text-white">Find your first agent</h1>
              <p className="text-muted text-sm">What do you need help with?</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value === selectedCategory ? null : cat.value)}
                    className={`p-3 rounded-xl text-sm font-medium transition-all border ${
                      selectedCategory === cat.value
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-surface-2 bg-surface-2 text-muted hover:border-muted-2 hover:text-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {selectedCategory && (
                  <Button onClick={() => handleFinish(selectedCategory)} className="w-full">
                    Find {CATEGORIES.find(c => c.value === selectedCategory)?.label} agents →
                  </Button>
                )}
                <Button variant={selectedCategory ? "secondary" : "primary"} onClick={() => handleFinish()} className="w-full">
                  Browse all agents →
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
