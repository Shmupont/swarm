"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Zap, Bot, ArrowUpRight } from "lucide-react";
import { getToken } from "@/lib/auth";
import { getCreatorEarnings } from "@/lib/api";
import type { CreatorEarningsEntry } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AgentBreakdown {
  agent_profile_id: string;
  agent_name: string | null;
  total_gross: number;
  total_fee: number;
  total_net: number;
  count: number;
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

export default function EarningsPage() {
  const [earnings, setEarnings] = useState<CreatorEarningsEntry[]>([]);
  const [totalNet, setTotalNet] = useState(0);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const byAgent = groupByAgent(earnings);

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
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">
        Creator Earnings
      </h1>

      {/* Summary card */}
      <Card className="p-6 mb-8">
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

      {/* Payout placeholder */}
      <Card className="p-5 mb-8 flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">Payout to Bank</p>
          <p className="text-sm text-muted">
            Credit-to-cash payouts — coming soon. Earnings accumulate as credits in your wallet.
          </p>
        </div>
        <button
          disabled
          className="text-sm text-muted-2 bg-surface-2 px-4 py-2 rounded-xl cursor-not-allowed"
        >
          Request Payout
        </button>
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
          <div className="grid grid-cols-5 gap-3 px-5 py-3 text-xs font-medium text-muted border-b border-white/[0.04]">
            <span className="col-span-2">Agent</span>
            <span>Gross</span>
            <span>Platform Fee</span>
            <span>Net Earned</span>
          </div>
          {byAgent.map((row, i) => (
            <div
              key={row.agent_profile_id}
              className={`grid grid-cols-5 gap-3 px-5 py-4 items-center text-sm ${
                i > 0 ? "border-t border-white/[0.04]" : ""
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
                <span className="text-muted-2 text-xs ml-1">(20%)</span>
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
                  i > 0 ? "border-t border-white/[0.04]" : ""
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
