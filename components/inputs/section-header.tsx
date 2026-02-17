"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SectionAccentColour = "blue" | "green" | "purple" | "amber" | "zinc";

const ACCENT_BAR_CLASSES: Record<SectionAccentColour, string> = {
  blue: "bg-blue-500/70",
  green: "bg-emerald-500/70",
  purple: "bg-purple-500/70",
  amber: "bg-amber-500/70",
  zinc: "bg-zinc-400/60",
};

export interface SectionHeaderProps {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  accent?: SectionAccentColour;
  /** Optional right-side actions */
  actions?: React.ReactNode;
  /** Optional completion badge (e.g. 3/7) */
  completion?: { completed: number; total: number };
  className?: string;
}

export function SectionHeader({
  id,
  title,
  description,
  accent = "zinc",
  actions,
  completion,
  className,
}: SectionHeaderProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex items-start gap-4 rounded-t-xl border border-border/50 border-b-0 bg-muted/40 px-5 py-4",
        "min-h-[4rem]",
        className
      )}
    >
      <div
        className={cn("w-1 shrink-0 self-stretch rounded-full", ACCENT_BAR_CLASSES[accent])}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {completion != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {completion.completed}/{completion.total}
            </span>
          )}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
