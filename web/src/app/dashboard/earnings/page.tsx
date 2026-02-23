"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Zap, Bot, ArrowUpRight, CheckCircle, CreditCard, X } from "lucide-react";
import { getToken } from "@/lib/auth";
import { getCreatorEarnings, getConnectStatus, getConnectOnboardUrl, requestCashout } from "@/lib/api";
import type { CreatorEarningsEntry } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface AgentBreakdown {
  agent_profile_id: string;
  agent_name: string | null;
  total_gross: number;
  total_fee: number;
  total_net: number;
  count: number;
}

interface ConnectStatus {
  connected: boolean;
  verified: boolean;
  stripe_account_id: string | null;
}

function groupByAgent(earnings: CreatorEarningsEntry[]): AgentBreakdown[] {
  const map = new Map<string, AgentBreakdown>();
  for (const e of earnings) {
    const existing = map.get(e.agent_profile_id);
    if (existing) {
      existing.total_gross += e.gross_credits;
      existing.total_fee += e.platform_fee_credits;
      existing.total_net += e.net_credits;
      existing.count += 1;
    } else {
      map.set(e.agent_profile_id, {
        agent_profile_id: e.agent_profile_id,
        agent_name: e.agent_name,
        total_gross: e.gross_credits,
        total_fee: e.platform_fee_credits,
        total_net: e.net_credits,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total_net - a.total_net);
}

function CashoutModal({
  maxCredits,
  onClose,
  onSuccess,
}: {
  maxCredits: number;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const usd = (amount / 100).toFixed(2);

  async function handleCashout() {
    if (amount < 1000) {
      setError("Minimum cashout is 1,000 credits ($10.00)");
      return;
    }
    if (amount > maxCredits) {
      setError("Insufficient credit balance");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = getToken()!;
      await requestCashout(token, amount);
      onSuccess(amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cashout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-elevated"
        style={{ background: "#080f1e", border: "1px solid rgba(59,130,246,0.25)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-heading text-lg font-bold text-foreground mb-1">Request Cashout</h2>
        <p className="text-sm text-muted mb-6">
          Credits convert to USD at 100 credits = $1.00. Minimum 1,000 credits.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Credits to cash out</label>
            <input
              type="number"
              min={1000}
              max={maxCredits}
              step={100}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-accent"
            />
            <p className="text-xs text-muted mt-1.5">
              = <span className="text-accent font-semibold">${usd}</span> USD
            </p>
          </div>

          <div className="bg-surface-2 rounded-xl px-4 py-3 text-xs text-muted space-y-1">
            <div className="flex justify-between">
              <span>Credits to cash out</span>
              <span className="text-foreground">{amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>USD amount</span>
              <span className="text-accent font-semibold">${usd}</span>
            </div>
            <div className="flex justify-between">
              <span>Arrival</span>
              <span className="text-foreground">2–3 business days</span>
            </div>
          </div>

          {error && (
            <div className="bg-error/10 text-error text-xs px-3 py-2 rounded-xl">{error}</div>
          )}

          <Button onClick={handleCashout} disabled={loading} className="w-full">
            {loading ? "Processing..." : `Cash Out $${usd}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<CreatorEarningsEntry[]>([]);
  const [totalNet, setTotalNet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [showCashout, setShowCashout] = useState(false);
  const [cashoutSuccess, setCashoutSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getCreatorEarnings(token)
      .then((data) => {
        setEarnings(data.earnings);
        setTotalNet(data.total_net_credits);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    getConnectStatus(token)
      .then(setConnectStatus)
      .catch(() => {});
  }, []);

  const byAgent = groupByAgent(earnings);

  async function handleConnectBank() {
    const token = getToken();
    if (!token) return;
    setConnectLoading(true);
    try {
      const { url } = await getConnectOnboardUrl(token);
      window.location.href = url;
    } catch (err) {
      console.error(err);
    } finally {
      setConnectLoading(false);
    }
  }

  function handleCashoutSuccess(amount: number) {
    setShowCashout(false);
    setTotalNet((prev) => prev - amount);
    setCashoutSuccess(
      `Transfer initiated for ${amount.toLocaleString()} credits ($${(amount / 100).toFixed(2)}). Funds arrive in 2–3 business days.`
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold text-foreground">Creator Earnings</h1>
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div>
      {showCashout && (
        <CashoutModal
          maxCredits={totalNet}
          onClose={() => setShowCashout(false)}
          onSuccess={handleCashoutSuccess}
        />
      )}

      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">
        Creator Earnings
      </h1>

      {/* Summary card */}
      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-muted mb-1">Total Earned (Net)</p>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" />
              <span className="font-heading font-black text-3xl text-foreground">
                {totalNet.toLocaleString()}
              </span>
              <span className="text-sm text-muted">credits</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Total Transactions</p>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted" />
              <span className="font-heading font-bold text-2xl text-foreground">
                {earnings.length}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Agents Earning</p>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-muted" />
              <span className="font-heading font-bold text-2xl text-foreground">
                {byAgent.length}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Payout Account (Stripe Connect) */}
      <Card className="p-5 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Payout Account</p>
              {connectStatus?.connected && connectStatus.verified ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                  <span className="text-sm text-success">Stripe account connected</span>
                </div>
              ) : connectStatus?.connected && !connectStatus.verified ? (
                <p className="text-sm text-warning mt-0.5">Stripe account pending verification</p>
              ) : (
                <p className="text-sm text-muted mt-0.5">Connect your bank account to receive payouts</p>
              )}

              {connectStatus?.connected && connectStatus.verified && (
                <p className="text-xs text-muted mt-1">
                  Balance ready to withdraw:{" "}
                  <span className="text-foreground font-semibold">
                    {totalNet.toLocaleString()} credits (${(totalNet / 100).toFixed(2)})
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {connectStatus?.connected && connectStatus.verified ? (
              <Button
                onClick={() => setShowCashout(true)}
                disabled={totalNet < 1000}
                size="sm"
              >
                Request Cashout
              </Button>
            ) : (
              <Button
                onClick={handleConnectBank}
                disabled={connectLoading}
                size="sm"
              >
                {connectLoading ? "Redirecting..." : "Connect Bank Account →"}
              </Button>
            )}
          </div>
        </div>

        {cashoutSuccess && (
          <div className="mt-4 bg-success/10 text-success text-sm px-4 py-3 rounded-xl">
            {cashoutSuccess}
          </div>
        )}
      </Card>

      {/* Per-agent breakdown */}
      <h2 className="font-heading text-lg font-bold text-foreground mb-3">
        Per-Agent Breakdown
      </h2>

      {byAgent.length === 0 ? (
        <Card className="p-10 text-center">
          <Zap className="w-10 h-10 text-muted-2 mx-auto mb-3" />
          <p className="font-medium text-foreground mb-1">No earnings yet</p>
          <p className="text-sm text-muted">
            When users pay to chat with your agents, earnings will appear here.
          </p>
          <Link
            href="/dashboard/agents"
            className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover mt-4 transition-colors"
          >
            Manage agents <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden mb-8">
          <div className="grid grid-cols-5 gap-3 px-5 py-3 text-xs font-medium text-muted border-b border-border">
            <span className="col-span-2">Agent</span>
            <span>Gross</span>
            <span>Platform Fee</span>
            <span>Net Earned</span>
          </div>
          {byAgent.map((row, i) => (
            <div
              key={row.agent_profile_id}
              className={`grid grid-cols-5 gap-3 px-5 py-4 items-center text-sm ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="col-span-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent-soft flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="font-medium text-foreground truncate">
                  {row.agent_name || "Unknown Agent"}
                </span>
              </div>
              <span className="font-mono text-muted">{row.total_gross.toLocaleString()}</span>
              <span className="font-mono text-muted">
                -{row.total_fee.toLocaleString()}
                <span className="text-muted-2 text-xs ml-1">(10%)</span>
              </span>
              <span className="font-mono font-bold text-accent">
                {row.total_net.toLocaleString()}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Recent transactions */}
      {earnings.length > 0 && (
        <>
          <h2 className="font-heading text-lg font-bold text-foreground mb-3">
            Recent Transactions
          </h2>
          <Card>
            {earnings.slice(0, 20).map((e, i) => (
              <div
                key={e.id}
                className={`flex items-center justify-between px-5 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {e.agent_name || "Agent"}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(e.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-accent">
                    +{e.net_credits.toLocaleString()} cr
                  </p>
                  <p className="text-xs text-muted-2">
                    Gross {e.gross_credits} · Fee {e.platform_fee_credits}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
