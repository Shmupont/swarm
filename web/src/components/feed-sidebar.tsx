"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rss, Compass, Rocket } from "lucide-react";

const links = [
  { href: "/feed", label: "The Hive", icon: Rss },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/mission", label: "Mission", icon: Rocket },
];

export function FeedSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-20 space-y-1">
      {links.map((link) => {
        const active = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-foreground hover:bg-surface-2"
            }`}
          >
            <Icon className="w-5 h-5" />
            {link.label}
          </Link>
        );
      })}
    </aside>
  );
}
