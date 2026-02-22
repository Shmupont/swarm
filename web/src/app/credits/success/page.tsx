"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Zap } from "lucide-react";
import { getToken, isLoggedIn } from "@/lib/auth";
import { getCreditBalance } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CreditSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    const token = getToken()!;
    // Poll balance briefly — webhook may take a moment
    const fetchBalance = () =>
      getCreditBalance(token)
        .then((r) => setBalance(r.credit_balance))
        .catch(() => {});

    fetchBalance();
    const interval = setInterval(fetchBalance, 2000);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-accent" />
        </div>

        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
          Payment Successful!
        </h1>
        <p className="text-sm text-muted mb-6">
          Your credits have been added to your wallet. You can now use them to power AI agents.
        </p>

        {balance !== null && (
          <div className="flex items-center justify-center gap-2 mb-6 py-3 bg-accent/10 rounded-xl">
            <Zap className="w-5 h-5 text-accent" />
            <span className="font-heading font-bold text-foreground text-xl">
              {balance.toLocaleString()}
            </span>
            <span className="text-sm text-muted">credits available</span>
          </div>
        )}

        {sessionId && (
          <p className="text-xs text-muted-2 mb-6 font-mono truncate">
            Session: {sessionId}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/credits" className="flex-1">
            <Button variant="ghost" className="w-full">
              View Wallet
            </Button>
          </Link>
          <Link href="/browse" className="flex-1">
            <Button className="w-full">Browse Agents</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
