"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";

interface StatNumberProps {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

export function StatNumber({
  value,
  label,
  suffix = "",
  prefix = "",
  decimals = 0,
}: StatNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const motionValue = useMotionValue(0);

  useEffect(() => {
    const unsub = motionValue.on("change", (v) => {
      setDisplayValue(Number(v.toFixed(decimals)));
    });
    return unsub;
  }, [motionValue, decimals]);

  useEffect(() => {
    if (!ref.current || hasAnimated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasAnimated(true);
          animate(motionValue, value, { duration: 1.5, ease: "easeOut" });
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, motionValue, hasAnimated]);

  return (
    <div ref={ref} className="text-center">
      <div className="font-mono text-3xl font-bold text-accent">
        {prefix}
        {displayValue.toLocaleString()}
        {suffix}
      </div>
      <div className="text-muted text-sm mt-1">{label}</div>
    </div>
  );
}
