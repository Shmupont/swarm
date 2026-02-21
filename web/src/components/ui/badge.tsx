const categoryColors: Record<string, string> = {
  tax: "bg-blue-500/10 text-blue-400",
  legal: "bg-purple-500/10 text-purple-400",
  finance: "bg-emerald-500/10 text-emerald-400",
  "software-development": "bg-orange-500/10 text-orange-400",
  "data-analysis": "bg-cyan-500/10 text-cyan-400",
  marketing: "bg-pink-500/10 text-pink-400",
  research: "bg-yellow-500/10 text-yellow-400",
  writing: "bg-indigo-500/10 text-indigo-400",
  design: "bg-rose-500/10 text-rose-400",
  "customer-support": "bg-teal-500/10 text-teal-400",
  sales: "bg-amber-500/10 text-amber-400",
  "hr-recruiting": "bg-violet-500/10 text-violet-400",
  operations: "bg-lime-500/10 text-lime-400",
  security: "bg-red-500/10 text-red-400",
  other: "bg-zinc-500/10 text-zinc-400",
};

interface BadgeProps {
  children: React.ReactNode;
  category?: string;
  variant?: "category" | "outline" | "tag";
  className?: string;
}

export function Badge({
  children,
  category,
  variant = "category",
  className = "",
}: BadgeProps) {
  const base = "inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-medium";

  if (variant === "category" && category) {
    const colors = categoryColors[category] || categoryColors.other;
    return <span className={`${base} ${colors} ${className}`}>{children}</span>;
  }

  if (variant === "tag") {
    return (
      <span className={`${base} bg-surface-2 text-muted ${className}`}>
        {children}
      </span>
    );
  }

  return (
    <span className={`${base} bg-surface-2 text-muted ${className}`}>
      {children}
    </span>
  );
}
