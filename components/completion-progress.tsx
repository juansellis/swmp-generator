"use client";

import { cn } from "@/lib/utils";

export interface CompletionProgressProps {
  /** Number of completed items */
  completed: number;
  /** Total number of items */
  total: number;
  label?: string;
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function CompletionProgress({
  completed,
  total,
  label,
  showLabel = true,
  className,
  size = "sm",
}: CompletionProgressProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const text = label ?? `${completed}/${total}`;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-muted",
          size === "sm" ? "h-2 w-16" : "h-2.5 w-20"
        )}
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={text}
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? (
        <span className="text-xs text-muted-foreground tabular-nums">{text}</span>
      ) : null}
    </div>
  );
}
