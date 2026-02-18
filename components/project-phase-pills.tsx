"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ProjectPhasePillsProps {
  projectId: string;
  className?: string;
}

const PHASES: { label: string; href: (id: string) => string; pillClass: string }[] = [
  { label: "Inputs", href: (id) => `/projects/${id}/inputs`, pillClass: "border-green-500 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30" },
  { label: "Forecasting", href: (id) => `/projects/${id}/forecast`, pillClass: "border-blue-500 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30" },
  { label: "Report", href: (id) => `/projects/${id}/report`, pillClass: "border-purple-500 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30" },
];

/**
 * Navigational phase pills for project cards. Links only; no active state (dashboard has no active phase).
 */
export function ProjectPhasePills({ projectId, className }: ProjectPhasePillsProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      role="navigation"
      aria-label="Project phases"
    >
      {PHASES.map(({ label, href, pillClass }) => (
        <Link
          key={label}
          href={href(projectId)}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center rounded-full border bg-secondary/50 px-2 py-0.5 text-xs font-medium transition-colors",
            pillClass
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
