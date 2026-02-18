"use client";

import { cn } from "@/lib/utils";
import {
  computeProjectStatus,
  STATUS_LABELS,
  type ProjectStatusData,
  type ProjectStatusState,
} from "@/lib/projectStatus";

const PILL_STYLES: Record<ProjectStatusState, string> = {
  complete: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  not_started: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
};

export interface ProjectStatusPillsProps {
  status: ProjectStatusData;
  className?: string;
  /** Show labels (Inputs, Forecasting, Report). Default true. */
  showLabels?: boolean;
}

export function ProjectStatusPills({
  status,
  className,
  showLabels = true,
}: ProjectStatusPillsProps) {
  const computed = computeProjectStatus(status);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      role="status"
      aria-label={`Project status: Inputs ${computed.inputs}, Forecasting ${computed.forecasting}, Report ${computed.outputs}`}
    >
      {(["inputs", "forecasting", "outputs"] as const).map((key) => (
        <span
          key={key}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            PILL_STYLES[computed[key]]
          )}
          title={`${STATUS_LABELS[key]}: ${computed[key] === "complete" ? "Complete" : computed[key] === "in_progress" ? "In progress" : "Not started"}`}
        >
          {showLabels ? STATUS_LABELS[key] : null}
          <span className="sr-only">
            {" "}
            {computed[key] === "complete"
              ? "Complete"
              : computed[key] === "in_progress"
                ? "In progress"
                : "Not started"}
          </span>
        </span>
      ))}
    </div>
  );
}
