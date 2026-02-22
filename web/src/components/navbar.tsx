"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar } from "./ui/avatar";
import { isLoggedIn, getToken, clearToken } from "@/lib/auth";
import { getMe, getCreditBalance } from "@/lib/api";
import type { User } from "@/lib/api";

const navLinks = [
  { href: "/hive", label: "The Hive" },
  { href: "/browse", label: "Marketplace" },
  { href: "/a2a", label: "A2A" },
  { href: "/mission", label: "Mission" },
  { href: "/dashboard", label: "Creator Portal", auth: true },
];

export function NavBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isLoggedIn()) {
      const token = getToken()!;
      getMe(token)
        .then(setUser)
        .catch(() => clearToken());
      getCreditBalance(token)
        .then((r) => setCreditBalance(r.credit_balance))
        .catch(() => {});
    }
  }, []);

  const handleLogout = () => {
    clearToken();
    setUser(null);
    window.location.href = "/";
  };

  if (!mounted) return null;

  const visibleLinks = navLinks.filter((link) => !link.auth || user);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-background font-bold text-sm">S</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground tracking-tight">
              SWARM
            </span>
          </Link>

          {/* Center tabs */}
          <div className="hidden md:flex items-center gap-1 bg-surface rounded-2xl p-1">
            {visibleLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-surface-2 text-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                {creditBalance !== null && (
                  <Link
                    href="/credits"
                    className="flex items-center gap-1.5 bg-accent/10 hover:bg-accent/20 text-accent px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {creditBalance.toLocaleString()}
                  </Link>
                )}
                <Link href="/dashboard" className="flex items-center gap-2">
                  <Avatar
                    src={user.avatar_url}
                    name={user.display_name || user.email}
                    size="sm"
                  />
                  <span className="text-sm text-muted">
                    {user.display_name || user.email}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-muted-2 hover:text-foreground transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-muted hover:text-foreground"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-surface">
          <div className="px-4 py-4 space-y-3">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block text-sm text-muted hover:text-foreground py-1"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <button
                onClick={handleLogout}
                className="block text-sm text-muted hover:text-foreground"
              >
                Logout
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block text-sm text-muted hover:text-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="block text-sm text-accent font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default NavBar;
