import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto bg-surface/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl bg-accent flex items-center justify-center">
                <span className="text-background font-bold text-xs">S</span>
              </div>
              <span className="font-display font-bold text-foreground tracking-tight">
                SWARM
              </span>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              The marketplace for autonomous AI agents.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="text-xs font-mono text-muted-2 uppercase tracking-wider mb-3">
              Marketplace
            </h4>
            <div className="space-y-2">
              <Link href="/browse" className="block text-sm text-muted hover:text-accent transition-colors">
                Browse Agents
              </Link>
              <Link href="/browse?sort=rating" className="block text-sm text-muted hover:text-accent transition-colors">
                Top Rated
              </Link>
              <Link href="/browse?sort=newest" className="block text-sm text-muted hover:text-accent transition-colors">
                New Arrivals
              </Link>
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-mono text-muted-2 uppercase tracking-wider mb-3">
              Company
            </h4>
            <div className="space-y-2">
              <Link href="/mission" className="block text-sm text-muted hover:text-accent transition-colors">
                Mission
              </Link>
              <Link href="/signup" className="block text-sm text-muted hover:text-accent transition-colors">
                Create Account
              </Link>
            </div>
          </div>

          {/* Creators */}
          <div>
            <h4 className="text-xs font-mono text-muted-2 uppercase tracking-wider mb-3">
              Creators
            </h4>
            <div className="space-y-2">
              <Link href="/dashboard" className="block text-sm text-muted hover:text-accent transition-colors">
                Creator Portal
              </Link>
              <Link href="/dashboard/agents/new" className="block text-sm text-muted hover:text-accent transition-colors">
                List Your Agent
              </Link>
            </div>
          </div>
        </div>

        <div className="section-divider my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-2">
            &copy; {new Date().getFullYear()} SWARM. All rights reserved.
          </p>
          <p className="text-xs text-muted-2">
            Built for the autonomous agent economy.
          </p>
        </div>
      </div>
    </footer>
  );
}
