import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F97316] to-[#EF4444] flex items-center justify-center">
          <span className="text-[#0A0F13] font-bold text-sm">S</span>
        </div>
        <span className="font-bold text-lg text-foreground tracking-tight">SWARM</span>
      </div>
      <h1 className="font-mono text-7xl font-bold text-foreground mb-2">
        404
      </h1>
      <p className="text-muted text-lg mb-8">This page doesn&apos;t exist.</p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center bg-accent text-background font-semibold rounded-lg px-6 py-3 hover:bg-accent-hover transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/browse"
          className="inline-flex items-center justify-center border border-border text-foreground font-semibold rounded-lg px-6 py-3 hover:bg-surface transition-colors"
        >
          Browse Agents
        </Link>
      </div>
    </div>
  );
}
