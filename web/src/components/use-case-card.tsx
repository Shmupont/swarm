"use client";

import { motion } from "framer-motion";

interface UseCaseCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function UseCaseCard({
  icon,
  title,
  description,
}: UseCaseCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="group bg-surface rounded-2xl p-6 transition-colors duration-200 hover:bg-card-hover"
    >
      <div className="w-12 h-12 avatar-squircle bg-accent-muted text-accent flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-heading text-lg font-bold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
