"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken } from "@/lib/auth";
import { getMe, type User } from "@/lib/api";
import { Settings, User as UserIcon, Shield, LogOut } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getMe(token)
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="h-7 w-24 bg-border rounded animate-pulse" />
        <div className="h-40 bg-surface border border-border rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <UserIcon className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Profile</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Email</label>
            <div className="bg-[var(--bg-secondary)] border border-border rounded-lg px-3 py-2 text-sm text-[var(--foreground)]">
              {user?.email || "—"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Display Name</label>
            <div className="bg-[var(--bg-secondary)] border border-border rounded-lg px-3 py-2 text-sm text-[var(--foreground)]">
              {user?.display_name || "Not set"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Member Since</label>
            <div className="bg-[var(--bg-secondary)] border border-border rounded-lg px-3 py-2 text-sm text-muted font-mono">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Security</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Manage your authentication and security settings.
        </p>
        <div className="space-y-2">
          <button
            disabled
            className="w-full text-left bg-[var(--bg-secondary)] border border-border rounded-lg px-4 py-3 text-sm text-muted cursor-not-allowed"
          >
            Change Password (coming soon)
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-surface border border-destructive/30 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <LogOut className="w-4 h-4 text-destructive" />
          <h2 className="text-sm font-semibold text-destructive">Sign Out</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Sign out of your account on this device.
        </p>
        <button
          onClick={handleLogout}
          className="bg-destructive/10 text-destructive border border-destructive/30 font-medium rounded-lg px-4 py-2 text-sm hover:bg-destructive/20 transition-colors"
        >
          Sign Out
        </button>
      </section>
    </div>
  );
}
