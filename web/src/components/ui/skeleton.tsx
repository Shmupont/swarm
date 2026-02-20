interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`bg-surface-2 animate-pulse rounded-2xl ${className}`} />
  );
}
