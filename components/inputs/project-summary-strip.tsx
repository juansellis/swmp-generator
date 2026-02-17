"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface ProjectSummaryStripProps {
  region?: string | null;
  projectType?: string | null;
  mainContractor?: string | null;
  /** Short facility summary (e.g. "3 facilities" or partner name) */
  facilitySummary?: string | null;
  /** Total estimated waste in tonnes */
  totalEstimatedWasteTonnes?: number | null;
  className?: string;
}

export function ProjectSummaryStrip({
  region,
  projectType,
  mainContractor,
  facilitySummary,
  totalEstimatedWasteTonnes,
  className,
}: ProjectSummaryStripProps) {
  const hasAny =
    (region?.trim() ?? "") !== "" ||
    (projectType?.trim() ?? "") !== "" ||
    (mainContractor?.trim() ?? "") !== "" ||
    (facilitySummary?.trim() ?? "") !== "" ||
    (totalEstimatedWasteTonnes != null && Number.isFinite(totalEstimatedWasteTonnes));

  if (!hasAny) return null;

  const tonnesLabel =
    totalEstimatedWasteTonnes != null && Number.isFinite(totalEstimatedWasteTonnes) && totalEstimatedWasteTonnes > 0
      ? `${totalEstimatedWasteTonnes.toFixed(2)} t`
      : "—";

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/40 px-5 py-3",
        "flex flex-wrap items-center gap-x-4 gap-y-2",
        className
      )}
      role="region"
      aria-label="Project summary"
    >
      {region?.trim() ? (
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Region</span>
          <Badge variant="secondary" className="font-normal text-xs">
            {region.trim()}
          </Badge>
        </span>
      ) : null}
      {projectType?.trim() ? (
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</span>
          <Badge variant="outline" className="font-normal text-xs">
            {projectType.trim()}
          </Badge>
        </span>
      ) : null}
      {mainContractor?.trim() ? (
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contractor</span>
          <span className="text-sm text-foreground">{mainContractor.trim()}</span>
        </span>
      ) : null}
      {facilitySummary?.trim() ? (
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Facilities</span>
          <span className="text-sm text-foreground">{facilitySummary.trim()}</span>
        </span>
      ) : null}
      <span className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Est. waste</span>
        <span className="text-sm font-medium tabular-nums text-foreground">{tonnesLabel}</span>
      </span>
    </div>
  );
}
