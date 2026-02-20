"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken } from "@/lib/auth";
import { getMe, getConversations, type User } from "@/lib/api";
import Sidebar from "@/components/sidebar";
import { Bell, Menu, X } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    getMe(token)
      .then(setUser)
      .catch(() => {
        clearToken();
        router.replace("/login");
      })
      .finally(() => setLoading(false));

    getConversations(token)
      .then((convs) => {
        const total = convs.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        setUnreadMessages(total);
      })
      .catch(() => {});
  }, [router]);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm font-mono">Loading command center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onLogout={handleLogout}
          unreadMessages={unreadMessages}
        />
      </div>

      {/* Sidebar — mobile */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          collapsed={false}
          onToggle={() => setMobileOpen(false)}
          onLogout={handleLogout}
          unreadMessages={unreadMessages}
        />
      </div>

      {/* Main content */}
      <div className={`transition-all duration-200 ${collapsed ? "lg:ml-16" : "lg:ml-60"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-14 bg-[var(--background)]/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-muted hover:text-[var(--foreground)] transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="text-sm font-medium text-muted hidden sm:block">Creator Portal</span>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative text-muted hover:text-[var(--foreground)] transition-colors p-2">
              <Bell className="w-[18px] h-[18px]" />
              {unreadMessages > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                {(user?.display_name || user?.email || "?")[0].toUpperCase()}
              </div>
              <span className="text-sm text-[var(--foreground)] hidden sm:block">
                {user?.display_name || user?.email}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
