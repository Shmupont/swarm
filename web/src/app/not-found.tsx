import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-4">
      <div className="text-accent font-heading font-black text-2xl mb-8">SWARM</div>
      <h1 className="font-heading text-6xl font-bold text-[var(--foreground)] mb-2">404</h1>
      <p className="text-muted text-lg mb-8">This page doesn&apos;t exist.</p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center bg-accent text-[var(--background)] font-semibold rounded-lg px-6 py-3 hover:bg-accent-hover transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center border border-border text-[var(--foreground)] font-semibold rounded-lg px-6 py-3 hover:bg-surface transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
