"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type DecisionChipState = "separated" | "mixed" | "missing";

const STYLES: Record<DecisionChipState, string> = {
  separated:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  mixed:
    "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700",
  missing:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
};

const LABELS: Record<DecisionChipState, string> = {
  separated: "Separated",
  mixed: "Mixed",
  missing: "Missing",
};

export interface DecisionChipProps {
  state: DecisionChipState;
  className?: string;
}

export function DecisionChip({ state, className }: DecisionChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium shrink-0",
        STYLES[state],
        className
      )}
    >
      {LABELS[state]}
    </span>
  );
}
