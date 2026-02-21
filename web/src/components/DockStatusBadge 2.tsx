interface DockStatusBadgeProps {
  isDocked: boolean;
  hasWebhook: boolean;
}

export function DockStatusBadge({ isDocked, hasWebhook }: DockStatusBadgeProps) {
  const ready = isDocked && hasWebhook;

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {ready && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            ready ? "bg-accent" : "bg-muted-2"
          }`}
        />
      </span>
      <span className={`text-xs font-mono uppercase tracking-wider ${ready ? "text-accent" : "text-muted"}`}>
        {ready ? "Docked" : "Listed"}
      </span>
    </div>
  );
}
