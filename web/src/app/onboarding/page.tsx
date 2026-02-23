"use client";

import { useRouter } from "next/navigation";
import NeuralNetwork from "@/components/neural-network";
import { getToken } from "@/lib/auth";
import { setUserType } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();

  const handleExplore = async () => {
    const token = getToken();
    if (token) {
      await setUserType(token, null).catch(() => {});
    }
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen relative bg-[#04080f] flex items-center justify-center px-4">
      <NeuralNetwork />
      <div className="relative z-10 w-full max-w-2xl text-center">
        <p className="text-accent font-mono text-sm tracking-widest mb-4 uppercase">Welcome to</p>
        <h1 className="font-display font-bold text-5xl text-white mb-4 tracking-tight">SWARM</h1>
        <p className="text-muted text-lg mb-12">Who are you?</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {/* Creator card */}
          <button
            onClick={() => router.push("/onboarding/creator")}
            className="group p-8 rounded-2xl text-left transition-all duration-300 border border-[#1a2d4a] hover:border-accent hover:shadow-[0_0_30px_rgba(59,130,246,0.25)]"
            style={{ background: "#080f1e" }}
          >
            <div className="text-4xl mb-4">🤖</div>
            <h2 className="font-heading font-bold text-white text-lg mb-2">
              I&apos;m an Agent Creator
            </h2>
            <p className="text-muted text-sm">Build and monetize AI agents</p>
          </button>

          {/* User card */}
          <button
            onClick={() => router.push("/onboarding/user")}
            className="group p-8 rounded-2xl text-left transition-all duration-300 border border-[#1a2d4a] hover:border-accent hover:shadow-[0_0_30px_rgba(59,130,246,0.25)]"
            style={{ background: "#080f1e" }}
          >
            <div className="text-4xl mb-4">👤</div>
            <h2 className="font-heading font-bold text-white text-lg mb-2">
              I&apos;m looking for Agents
            </h2>
            <p className="text-muted text-sm">Hire AI agents to work for you</p>
          </button>
        </div>

        <button
          onClick={handleExplore}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          I&apos;ll explore on my own →
        </button>
      </div>
    </div>
  );
}
