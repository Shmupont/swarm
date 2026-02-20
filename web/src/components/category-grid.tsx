"use client";

import {
  Calculator,
  Scale,
  DollarSign,
  Code2,
  BarChart3,
  Megaphone,
  BookOpen,
  PenTool,
  Palette,
  Headphones,
  ShoppingCart,
  Users,
  Settings,
  Shield,
  MoreHorizontal,
} from "lucide-react";

const categoryConfig: Record<
  string,
  { label: string; icon: React.ReactNode; bg: string; color: string }
> = {
  tax: { label: "Tax", icon: <Calculator className="w-7 h-7" />, bg: "bg-blue-500/15", color: "text-blue-400" },
  legal: { label: "Legal", icon: <Scale className="w-7 h-7" />, bg: "bg-purple-500/15", color: "text-purple-400" },
  finance: { label: "Finance", icon: <DollarSign className="w-7 h-7" />, bg: "bg-emerald-500/15", color: "text-emerald-400" },
  "software-development": { label: "Dev", icon: <Code2 className="w-7 h-7" />, bg: "bg-orange-500/15", color: "text-orange-400" },
  "data-analysis": { label: "Data", icon: <BarChart3 className="w-7 h-7" />, bg: "bg-cyan-500/15", color: "text-cyan-400" },
  marketing: { label: "Marketing", icon: <Megaphone className="w-7 h-7" />, bg: "bg-pink-500/15", color: "text-pink-400" },
  research: { label: "Research", icon: <BookOpen className="w-7 h-7" />, bg: "bg-yellow-500/15", color: "text-yellow-400" },
  writing: { label: "Writing", icon: <PenTool className="w-7 h-7" />, bg: "bg-indigo-500/15", color: "text-indigo-400" },
  design: { label: "Design", icon: <Palette className="w-7 h-7" />, bg: "bg-rose-500/15", color: "text-rose-400" },
  "customer-support": { label: "Support", icon: <Headphones className="w-7 h-7" />, bg: "bg-teal-500/15", color: "text-teal-400" },
  sales: { label: "Sales", icon: <ShoppingCart className="w-7 h-7" />, bg: "bg-amber-500/15", color: "text-amber-400" },
  "hr-recruiting": { label: "HR", icon: <Users className="w-7 h-7" />, bg: "bg-violet-500/15", color: "text-violet-400" },
  operations: { label: "Ops", icon: <Settings className="w-7 h-7" />, bg: "bg-lime-500/15", color: "text-lime-400" },
  security: { label: "Security", icon: <Shield className="w-7 h-7" />, bg: "bg-red-500/15", color: "text-red-400" },
  other: { label: "Other", icon: <MoreHorizontal className="w-7 h-7" />, bg: "bg-zinc-500/15", color: "text-zinc-400" },
};

interface CategoryGridProps {
  categories: { name: string; count: number }[];
  onSelect: (category: string) => void;
}

export function CategoryGrid({ categories, onSelect }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-5">
      {categories
        .filter((c) => c.count > 0 || categoryConfig[c.name])
        .map((cat) => {
          const config = categoryConfig[cat.name] || categoryConfig.other;
          return (
            <button
              key={cat.name}
              onClick={() => onSelect(cat.name)}
              className="flex flex-col items-center gap-2 group"
            >
              <div
                className={`w-16 h-16 avatar-squircle ${config.bg} ${config.color} flex items-center justify-center group-hover:scale-110 transition-transform`}
              >
                {config.icon}
              </div>
              <div className="text-sm font-medium text-muted group-hover:text-foreground transition-colors">
                {config.label}
              </div>
              <div className="text-xs text-muted-2">
                {cat.count}
              </div>
            </button>
          );
        })}
    </div>
  );
}
