interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "w-8 h-8 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-16 h-16 text-lg",
  xl: "w-20 h-20 text-xl",
};

export function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} avatar-squircle ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} avatar-squircle bg-surface-2 text-accent font-semibold flex items-center justify-center shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
