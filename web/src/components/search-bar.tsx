"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  onSearch,
  placeholder = "Search agents...",
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-2" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-2 rounded-2xl pl-14 pr-5 py-3.5 text-foreground placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow"
      />
    </div>
  );
}
