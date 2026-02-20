"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  ClipboardList,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "My Agents", icon: Bot },
  { href: "/dashboard/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  unreadMessages?: number;
}

export default function Sidebar({ collapsed, onToggle, onLogout, unreadMessages = 0 }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-[var(--bg-secondary)] border-r border-border flex flex-col z-40 transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-accent font-heading font-black text-lg tracking-tight">
          {collapsed ? "S" : "SWARM"}
        </span>
        {!collapsed && (
          <span className="text-muted text-xs ml-2 font-mono">CREATOR</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const showBadge = item.href === "/dashboard/messages" && unreadMessages > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative ${
                active
                  ? "bg-accent/10 text-accent border-l-2 border-accent"
                  : "text-muted hover:text-[var(--foreground)] hover:bg-surface"
              } ${collapsed ? "justify-center px-0" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {showBadge && (
                <span className={`bg-accent text-[var(--background)] text-[10px] font-bold rounded-full flex items-center justify-center ${
                  collapsed ? "absolute -top-0.5 -right-0.5 w-4 h-4" : "ml-auto w-5 h-5"
                }`}>
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-2 space-y-0.5">
        <button
          onClick={onLogout}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-destructive hover:bg-destructive/10 transition-colors w-full ${
            collapsed ? "justify-center px-0" : ""
          }`}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          onClick={onToggle}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-[var(--foreground)] hover:bg-surface transition-colors w-full ${
            collapsed ? "justify-center px-0" : ""
          }`}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronRight className="w-[18px] h-[18px]" />
          ) : (
            <>
              <ChevronLeft className="w-[18px] h-[18px] shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
