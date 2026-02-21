"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Key, Copy, Check, Activity, Clock, Zap } from "lucide-react";
import { getToken } from "@/lib/auth";
import { listMyLicenses, getLicenseUsage } from "@/lib/api";
import type { License, UsageStats } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function maskKey(key: string) {
  if (key.length <= 20) return key;
  return key.slice(0, 14) + "..." + key.slice(-4);
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-accent"
      : status === "expired"
        ? "bg-muted-2"
        : "bg-error";
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<Record<string, UsageStats>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    listMyLicenses(token)
      .then(setLicenses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCopy(key: string, id: string) {
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleExpand(licenseId: string) {
    if (expandedId === licenseId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(licenseId);
    if (!usageData[licenseId]) {
      const token = getToken();
      if (!token) return;
      try {
        const stats = await getLicenseUsage(token, licenseId);
        setUsageData((prev) => ({ ...prev, [licenseId]: stats }));
      } catch {}
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold text-foreground">My Licenses</h1>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">
        My Licenses
      </h1>

      {licenses.length === 0 ? (
        <Card className="p-12 text-center">
          <Key className="w-12 h-12 text-muted-2 mx-auto mb-4" />
          <h2 className="font-heading text-lg font-bold text-foreground mb-2">
            No licenses yet
          </h2>
          <p className="text-sm text-muted mb-4">
            Purchase access to an OpenClaw agent to get started.
          </p>
          <Link href="/browse">
            <Button>Browse Agents</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {licenses.map((lic) => {
            const expanded = expandedId === lic.id;
            const usage = usageData[lic.id];
            return (
              <Card key={lic.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusDot status={lic.status} />
                      <Link
                        href={`/agents/${lic.agent_slug}`}
                        className="font-heading font-bold text-foreground hover:text-accent transition-colors"
                      >
                        {lic.agent_name || "Unknown Agent"}
                      </Link>
                      <span className="text-xs text-muted capitalize bg-surface-2 px-2 py-0.5 rounded-lg">
                        {lic.plan_type?.replace("_", " ") || "Plan"}
                      </span>
                    </div>

                    <p className="text-sm text-muted">
                      {lic.plan_name} &middot; {lic.status}
                      {lic.expires_at && (
                        <> &middot; Expires {new Date(lic.expires_at).toLocaleDateString()}</>
                      )}
                    </p>

                    {/* License key */}
                    <div className="flex items-center gap-2 mt-3">
                      <code className="text-xs font-mono text-muted bg-surface-2 px-3 py-1.5 rounded-lg">
                        {maskKey(lic.license_key)}
                      </code>
                      <button
                        onClick={() => handleCopy(lic.license_key, lic.id)}
                        className="text-muted hover:text-accent transition-colors"
                        title="Copy license key"
                      >
                        {copiedId === lic.id ? (
                          <Check className="w-3.5 h-3.5 text-accent" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Usage stats */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted">
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span className="font-mono">{lic.total_messages}</span> requests
                        {lic.max_messages_per_period != null && (
                          <span className="text-muted-2">/ {lic.max_messages_per_period}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span className="font-mono">{lic.total_tokens_used.toLocaleString()}</span> tokens
                        {lic.max_tokens_per_period != null && (
                          <span className="text-muted-2">/ {lic.max_tokens_per_period.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExpand(lic.id)}
                  >
                    {expanded ? "Hide" : "Usage"}
                  </Button>
                </div>

                {/* Expanded usage log */}
                {expanded && (
                  <div className="mt-4 pt-4 border-t border-surface-2">
                    {!usage ? (
                      <div className="space-y-2">
                        <Skeleton className="h-6" />
                        <Skeleton className="h-6" />
                        <Skeleton className="h-6" />
                      </div>
                    ) : usage.recent_usage.length === 0 ? (
                      <p className="text-sm text-muted text-center py-4">No usage yet</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted px-2">
                          <span>Model</span>
                          <span>Tokens</span>
                          <span>Cost</span>
                          <span>Latency</span>
                          <span>Time</span>
                        </div>
                        {usage.recent_usage.map((log) => (
                          <div
                            key={log.id}
                            className={`grid grid-cols-5 gap-2 text-xs px-2 py-1.5 rounded-lg ${
                              log.success ? "bg-surface-2" : "bg-error/10"
                            }`}
                          >
                            <span className="font-mono text-foreground truncate">
                              {log.model.replace("claude-", "").split("-20")[0]}
                            </span>
                            <span className="font-mono text-muted">
                              {log.total_tokens.toLocaleString()}
                            </span>
                            <span className="font-mono text-muted">
                              ${(log.estimated_cost_cents / 100).toFixed(4)}
                            </span>
                            <span className="font-mono text-muted">
                              {log.response_time_ms}ms
                            </span>
                            <span className="text-muted-2">
                              {new Date(log.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
