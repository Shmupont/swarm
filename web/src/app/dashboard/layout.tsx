"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { getToken, isLoggedIn } from "@/lib/auth";
import { getMe } from "@/lib/api";
import Sidebar from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    const token = getToken()!;
    getMe(token)
      .then(() => setReady(true))
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-accent font-heading font-black text-xl animate-pulse">
          SWARM
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 glass h-14 flex items-center px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-accent font-heading font-black text-lg ml-3">
            SWARM
          </span>
        </header>

        <main className="flex-1 p-5 sm:p-7 lg:p-10 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
