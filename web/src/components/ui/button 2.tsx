"use client";

import { motion } from "framer-motion";
import { forwardRef } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-semibold rounded-2xl transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      primary: "bg-accent text-background hover:bg-accent-hover",
      secondary: "bg-surface-2 text-foreground hover:bg-elevated",
      ghost: "bg-transparent text-accent hover:bg-accent-soft",
    };

    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-5 py-2.5 text-sm",
      lg: "px-8 py-3.5 text-base",
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...(props as any)}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
export { Button };
