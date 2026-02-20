interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  inner?: boolean;
}

export function Card({ children, className = "", hover = false, inner = false }: CardProps) {
  return (
    <div
      className={`${inner ? "bg-surface-2" : "bg-surface"} rounded-2xl ${
        hover
          ? "transition-colors duration-200 hover:bg-card-hover cursor-pointer"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
