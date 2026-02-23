interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  inner?: boolean;
}

export function Card({ children, className = "", hover = false, inner = false }: CardProps) {
  return (
    <div
      className={`carbon-card rounded-2xl ${
        inner ? "bg-surface-2" : ""
      } ${
        hover
          ? "transition-colors duration-200 hover:bg-card-hover cursor-pointer"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
