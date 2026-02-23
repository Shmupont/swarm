"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, getMe } from "@/lib/api";
import { setToken, getToken } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import NeuralNetwork from "@/components/neural-network";

function getRedirectPath(user: { onboarding_completed: boolean; user_type: string | null }) {
  if (!user.onboarding_completed) return "/onboarding";
  if (user.user_type === "creator") return "/dashboard/mission-control";
  if (user.user_type === "user") return "/portal";
  return "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      setToken(data.access_token);
      const me = await getMe(data.access_token);
      router.push(getRedirectPath(me));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative bg-[#04080f] flex items-center justify-center px-4">
      <NeuralNetwork />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="text-white font-display font-bold text-2xl tracking-tight">
              SWARM
            </span>
          </Link>
          <h2 className="font-heading text-xl font-bold text-foreground mt-4">
            Welcome back
          </h2>
          <p className="text-muted text-sm mt-1">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "#080f1e",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          {error && (
            <div className="bg-error/10 text-error text-sm px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-sm text-center mt-4 text-muted">
          No account?{" "}
          <Link href="/signup" className="text-accent hover:text-accent-hover transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
