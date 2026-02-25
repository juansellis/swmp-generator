"use client";

import * as React from "react";
import { Check, AlertCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type PlanSectionStatus = "complete" | "needs_attention" | "not_started";

export interface PlanSectionHeaderProps {
  /** Icon element (e.g. <LayoutDashboard className="size-5" />) */
  icon: React.ReactNode;
  /** Section title */
  title: React.ReactNode;
  /** One-line short description */
  description?: React.ReactNode;
  /** Status badge: Complete | Needs attention */
  status?: PlanSectionStatus;
  /** Optional right-side actions */
  actions?: React.ReactNode;
  /** When true, header sticks to top when scrolling (use inside scroll container) */
  sticky?: boolean;
  /** Optional id for the section (e.g. for anchor links) */
  id?: string;
  className?: string;
}

export function PlanSectionHeader({
  icon,
  title,
  description,
  status,
  actions,
  sticky = true,
  id,
  className,
}: PlanSectionHeaderProps) {
  const statusBadge =
    status === "complete" ? (
      <Badge
        variant="secondary"
        className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
      >
        <Check className="size-3" /> Complete
      </Badge>
    ) : status === "needs_attention" ? (
      <Badge
        variant="secondary"
        className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
      >
        <AlertCircle className="size-3" /> Needs attention
      </Badge>
    ) : status === "not_started" ? (
      <Badge variant="secondary" className="gap-1 text-muted-foreground">
        <Circle className="size-3" /> Not started
      </Badge>
    ) : null;

  return (
    <div
      id={id}
      className={cn(
        "flex items-start gap-3 px-4 py-2.5 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        sticky && "sticky top-0 z-10",
        className
      )}
    >
      <span className="shrink-0 mt-0.5 text-muted-foreground [&>svg]:size-5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {statusBadge}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground line-clamp-1">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
