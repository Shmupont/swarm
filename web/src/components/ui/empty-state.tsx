import { Button } from "./button";

interface EmptyStateProps {
  icon: React.ReactNode;
  heading: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  heading,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-muted-2 mb-4">{icon}</div>
      <h3 className="font-heading text-lg font-bold text-foreground mb-2">
        {heading}
      </h3>
      <p className="text-muted text-sm max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
