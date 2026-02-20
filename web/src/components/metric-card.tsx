"use client";

import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
}

export default function MetricCard({ label, value, sublabel, icon: Icon, trend }: MetricCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 hover:border-border-hover transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center group-hover:bg-accent/15 transition-colors">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="font-mono text-3xl font-bold text-accent">{value}</div>
      <div className="flex items-center gap-2 mt-1.5">
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.positive ? "text-[var(--success)]" : "text-destructive"
            }`}
          >
            {trend.positive ? "\u2191" : "\u2193"} {trend.value}
          </span>
        )}
        {sublabel && <span className="text-xs text-muted">{sublabel}</span>}
      </div>
    </div>
  );
}
