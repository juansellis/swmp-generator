"use client";

import { cn } from "@/lib/utils";
import {
  computeProjectStatus,
  type ProjectStatusData,
  type ProjectStatusState,
} from "@/lib/projectStatus";

const PILL_STYLES: Record<ProjectStatusState, string> = {
  complete: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  not_started: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
};

export interface ProjectStatusPillProps {
  status: ProjectStatusData;
  /** Which phase to show (inputs | forecasting | outputs). Default: show single "Health" derived from all. */
  phase?: "inputs" | "forecasting" | "outputs";
  className?: string;
}

export function ProjectStatusPill({ status, phase, className }: ProjectStatusPillProps) {
  const computed = computeProjectStatus(status);
  const key = phase ?? ("inputs" as const);
  const state = computed[key];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        PILL_STYLES[state],
        className
      )}
      title={
        phase
          ? `${key}: ${state === "complete" ? "Complete" : state === "in_progress" ? "In progress" : "Not started"}`
          : undefined
      }
    >
      {phase ? (state === "complete" ? "Complete" : state === "in_progress" ? "In progress" : "Not started") : null}
    </span>
  );
}

/** 0-100 score from status: inputs complete + outputs complete weighted. */
function projectHealthScore(status: ProjectStatusData): number {
  let score = 0;
  if (status.inputs_complete) score += 50;
  if (status.outputs_generated) score += 50;
  if (status.inputs_complete && !status.outputs_generated) score = 60; // in progress
  return Math.min(100, score);
}

export type ProjectHealthLevel = "good" | "warning" | "weak";

function healthLevel(score: number): ProjectHealthLevel {
  if (score >= 80) return "good";
  if (score >= 40) return "warning";
  return "weak";
}

const HEALTH_STYLES: Record<ProjectHealthLevel, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  weak: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
};

export interface ProjectHealthBadgeProps {
  status: ProjectStatusData;
  className?: string;
  showScore?: boolean;
}

export function ProjectHealthBadge({
  status,
  className,
  showScore = true,
}: ProjectHealthBadgeProps) {
  const score = projectHealthScore(status);
  const level = healthLevel(score);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        HEALTH_STYLES[level],
        className
      )}
      title={`Project health: ${score}%`}
    >
      {showScore ? `${score}%` : level}
    </span>
  );
}
