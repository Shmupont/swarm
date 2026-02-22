"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ShoppingCart, Clock, CheckCircle, XCircle } from "lucide-react";
import { getToken, isLoggedIn } from "@/lib/auth";
import {
  getCreditPacks,
  getCreditBalance,
  getCreditHistory,
  createCreditCheckout,
} from "@/lib/api";
import type { CreditPack, CreditPurchaseRecord } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatCredits(n: number) {
  return n.toLocaleString();
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle className="w-4 h-4 text-accent" />;
  if (status === "refunded") return <XCircle className="w-4 h-4 text-error" />;
  return <Clock className="w-4 h-4 text-muted-2" />;
}

export default function CreditsPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [history, setHistory] = useState<CreditPurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    const token = getToken()!;
    Promise.all([
      getCreditBalance(token).then((r) => setBalance(r.credit_balance)),
      getCreditPacks().then(setPacks),
      getCreditHistory(token).then(setHistory),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  async function handleBuy(packId: string) {
    const token = getToken();
    if (!token) return;
    setBuying(packId);
    setError(null);
    try {
      const { checkout_url } = await createCreditCheckout(token, packId);
      window.location.href = checkout_url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start checkout");
      setBuying(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <Zap className="w-5 h-5 text-background" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Credits Wallet</h1>
          <p className="text-sm text-muted">Power AI agents with credits</p>
        </div>
      </div>

      {/* Balance card */}
      <Card className="p-6 mb-8">
        <p className="text-sm text-muted mb-1">Available Balance</p>
        <div className="flex items-end gap-2">
          <span className="font-heading text-4xl font-black text-foreground">
            {formatCredits(balance ?? 0)}
          </span>
          <span className="text-muted mb-1">credits</span>
        </div>
      </Card>

      {/* Credit packs */}
      <h2 className="font-heading text-lg font-bold text-foreground mb-4">Buy Credits</h2>

      {error && (
        <p className="text-sm text-error mb-4 bg-error/10 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {packs.map((pack, i) => {
          const isPopular = i === 1;
          return (
            <Card
              key={pack.id}
              className={`p-5 flex flex-col relative ${isPopular ? "ring-2 ring-accent" : ""}`}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold bg-accent text-background px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <div className="mb-4">
                <p className="font-heading font-bold text-foreground text-lg">{pack.name}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-mono font-black text-accent">
                    {formatCredits(pack.total_credits)}
                  </span>
                  <span className="text-sm text-muted">credits</span>
                </div>
                {pack.bonus_credits > 0 && (
                  <p className="text-xs text-accent mt-1">
                    Includes {formatCredits(pack.bonus_credits)} bonus credits
                  </p>
                )}
              </div>
              <div className="mt-auto">
                <p className="text-2xl font-bold text-foreground mb-3">
                  {formatPrice(pack.price_cents)}
                </p>
                <Button
                  className="w-full gap-2"
                  variant={isPopular ? "default" : "ghost"}
                  onClick={() => handleBuy(pack.id)}
                  disabled={buying === pack.id}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {buying === pack.id ? "Redirecting…" : "Buy Now"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Purchase history */}
      <h2 className="font-heading text-lg font-bold text-foreground mb-4">
        Purchase History
      </h2>

      {history.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">No purchases yet. Buy your first credit pack above.</p>
        </Card>
      ) : (
        <Card>
          {history.map((item, i) => (
            <div
              key={item.id}
              className={`flex items-center justify-between px-5 py-4 ${
                i > 0 ? "border-t border-white/[0.04]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <StatusIcon status={item.status} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.pack_name || "Credit Purchase"}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-bold text-accent">
                  +{formatCredits(item.credits_granted)}
                </p>
                <p className="text-xs text-muted">{formatPrice(item.amount_paid_cents)}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
