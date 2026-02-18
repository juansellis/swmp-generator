"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

export interface StreamRowProps {
  /** Stream name (title) */
  title: string;
  /** Optional icon for stream type */
  icon?: React.ReactNode;
  /** Optional badges (e.g. outcomes, partner) */
  badges?: React.ReactNode;
  /** Total tonnes display string (e.g. "1.234 tonne" or "—") */
  totalTonnes?: string;
  /** Optional facility/destination summary (compact row middle) */
  facilitySummary?: string;
  /** Optional status (e.g. "Complete" / "Needs destination") for compact row right */
  statusSummary?: React.ReactNode;
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
  icon,
  badges,
  totalTonnes,
  facilitySummary,
  statusSummary,
  expanded,
  onToggle,
  onRemove,
  children,
  className,
}: StreamRowProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-card overflow-hidden transition-shadow hover:shadow-sm",
        "flex flex-col",
        className
      )}
    >
      <div className="flex items-center gap-3 border-l-4 border-l-emerald-500/70 bg-muted/20 px-4 py-2.5 min-h-[52px]">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 min-w-0 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md py-1"
          aria-expanded={expanded}
        >
          {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground truncate">{title}</div>
            {(badges != null || totalTonnes || facilitySummary) && (
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                {totalTonnes ? <span className="tabular-nums">{totalTonnes}</span> : null}
                {facilitySummary ? (
                  <span className="truncate max-w-[200px]" title={facilitySummary}>
                    {facilitySummary}
                  </span>
                ) : null}
                {badges}
              </div>
            )}
          </div>
          {statusSummary ? <span className="shrink-0 text-xs text-muted-foreground">{statusSummary}</span> : null}
          <span className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
          </span>
        </button>
        {onRemove ? (
          <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="shrink-0">
            Remove
          </Button>
        ) : null}
      </div>
      {expanded && <div className="border-t border-border/50 bg-background px-4 py-4 space-y-4">{children}</div>}
    </div>
  );
}
