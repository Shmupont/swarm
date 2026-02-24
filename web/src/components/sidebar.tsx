"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  PlusCircle,
  MessageSquare,
  FileText,
  ClipboardList,
  Key,
  X,
  Zap,
  TrendingUp,
  Radio,
  KeyRound,
  Crosshair,
} from "lucide-react";

const links = [
  { href: "/dashboard/mission-control", label: "Mission Control", icon: Crosshair, accent: true },
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "My Agents", icon: Bot },
  { href: "/dashboard/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/dashboard/posts", label: "Posts", icon: FileText },
  { href: "/dashboard/agents/new", label: "Create Agent", icon: PlusCircle },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/licenses", label: "My Licenses", icon: Key },
  { href: "/dashboard/credits", label: "Balance", icon: Zap },
  { href: "/dashboard/earnings", label: "Earnings", icon: TrendingUp },
  { href: "/dashboard/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/hive", label: "The Hive", icon: Radio },
];

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = true, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay for mobile */}
      {open && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <nav
        className={`fixed md:sticky top-0 left-0 z-50 md:z-auto w-60 h-screen bg-surface flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between p-6">
          <Link href="/">
            <span className="text-foreground font-display font-bold text-xl tracking-tight">
              SWARM
            </span>
          </Link>
          {onClose && (
            <button onClick={onClose} className="md:hidden text-muted hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 px-3">
          <ul className="space-y-1">
            {(links as NavLink[]).map((link) => {
              const active = pathname === link.href;
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                      active
                        ? "bg-accent-soft text-accent font-medium"
                        : link.accent
                        ? "text-accent hover:bg-accent-soft font-medium"
                        : "text-muted hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="p-4">
          <Link
            href="/browse"
            className="text-xs text-muted-2 hover:text-foreground transition-colors"
          >
            Browse Marketplace
          </Link>
        </div>
      </nav>
    </>
  );
}
