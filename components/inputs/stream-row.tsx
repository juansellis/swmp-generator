"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

export interface StreamRowProps {
  /** Stream name (title) */
  title: string;
  /** Optional badges (e.g. outcomes, partner) */
  badges?: React.ReactNode;
  /** Total tonnes display string (e.g. "1.234 tonne" or "—") */
  totalTonnes?: string;
  expanded: boolean;
  onToggle: () => void;
  /** Optional remove button (e.g. "Remove" stream) */
  onRemove?: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Single waste stream row: elevated card with left accent, header (name + badges + tonnes), expandable panel.
 * Presentation only — does not manage state.
 */
export function StreamRow({
  title,
  badges,
  totalTonnes,
  expanded,
  onToggle,
  onRemove,
  children,
  className,
}: StreamRowProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden",
        "flex flex-col",
        className
      )}
    >
      <div className="flex items-center gap-3 border-l-4 border-l-emerald-500/70 bg-muted/30 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 min-w-0 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
          aria-expanded={expanded}
        >
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground truncate">{title}</div>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {badges}
              {totalTonnes ? (
                <span className="text-sm tabular-nums text-muted-foreground">{totalTonnes}</span>
              ) : null}
            </div>
          </div>
          <span className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
          </span>
        </button>
        {onRemove ? (
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            Remove
          </Button>
        ) : null}
      </div>
      {expanded && <div className="border-t border-border/50 bg-background px-4 py-4 space-y-4">{children}</div>}
    </div>
  );
}
