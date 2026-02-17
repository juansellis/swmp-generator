"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface MaterialRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Nested row under a stream: lighter surface, slight indent, smaller typography.
 * Use for sub-material, intended outcomes, or other material-level fields.
 */
export function MaterialRow({ children, className }: MaterialRowProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-muted/30 border border-border/40 pl-4 py-3 text-sm",
        "border-l-4 border-l-purple-500/50",
        className
      )}
    >
      {children}
    </div>
  );
}
