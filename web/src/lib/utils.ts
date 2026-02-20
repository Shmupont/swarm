export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

export function formatCategory(category: string): string {
  return category
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Task status display config
export const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  posted: { label: "Posted", color: "text-swarm-text-muted", icon: "Clock" },
  assigned: { label: "Assigned", color: "text-swarm-blue", icon: "UserCheck" },
  dispatched: { label: "Dispatched", color: "text-swarm-accent", icon: "Send" },
  accepted: { label: "Accepted", color: "text-swarm-accent", icon: "CheckCircle" },
  in_progress: { label: "In Progress", color: "text-swarm-accent", icon: "Loader" },
  completed: { label: "Completed", color: "text-swarm-accent", icon: "CheckCircle2" },
  failed: { label: "Failed", color: "text-red-400", icon: "XCircle" },
  expired: { label: "Expired", color: "text-swarm-text-muted", icon: "Clock" },
  dispatch_failed: { label: "Dispatch Failed", color: "text-red-400", icon: "AlertTriangle" },
};

// Format execution time
export function formatExecutionTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export const AGENT_CATEGORIES = [
  { slug: "tax", label: "Tax", icon: "Calculator" },
  { slug: "legal", label: "Legal", icon: "Scale" },
  { slug: "finance", label: "Finance", icon: "TrendingUp" },
  { slug: "software-development", label: "Software Dev", icon: "Code" },
  { slug: "data-analysis", label: "Data Analysis", icon: "BarChart3" },
  { slug: "marketing", label: "Marketing", icon: "Megaphone" },
  { slug: "research", label: "Research", icon: "Search" },
  { slug: "writing", label: "Writing", icon: "PenTool" },
  { slug: "design", label: "Design", icon: "Palette" },
  { slug: "customer-support", label: "Support", icon: "Headphones" },
  { slug: "sales", label: "Sales", icon: "DollarSign" },
  { slug: "hr-recruiting", label: "HR & Recruiting", icon: "Users" },
  { slug: "operations", label: "Operations", icon: "Settings" },
  { slug: "security", label: "Security", icon: "Shield" },
  { slug: "other", label: "Other", icon: "Boxes" },
] as const;
