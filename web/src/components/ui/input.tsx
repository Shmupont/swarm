"use client";

import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-muted mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-surface-2 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow ${
              icon ? "pl-10" : ""
            } ${error ? "ring-2 ring-error/50" : ""} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-error text-sm mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
