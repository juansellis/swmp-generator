"use client";

import { cn } from "@/lib/utils";

export type PriorityLevel = "low" | "medium" | "high";

const STYLES: Record<PriorityLevel, string> = {
  high: "bg-red-500/15 text-red-600 border-red-500/30 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40",
  medium: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40",
  low: "bg-slate-400/15 text-slate-600 border-slate-400/30 dark:bg-slate-400/20 dark:text-slate-400 dark:border-slate-400/40",
};

const LABELS: Record<PriorityLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export interface PriorityChipProps {
  level: PriorityLevel;
  className?: string;
}

export function PriorityChip({ level, className }: PriorityChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium shrink-0",
        STYLES[level],
        className
      )}
    >
      {LABELS[level]}
    </span>
  );
}
