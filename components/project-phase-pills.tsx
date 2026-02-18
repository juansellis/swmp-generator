"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ProjectPhasePillsProps {
  projectId: string;
  className?: string;
}

const PHASES: { label: string; href: (id: string) => string }[] = [
  { label: "Inputs", href: (id) => `/projects/${id}/inputs` },
  { label: "Forecasting", href: (id) => `/projects/${id}/forecast` },
  { label: "Report", href: (id) => `/projects/${id}/report` },
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
      {PHASES.map(({ label, href }) => (
        <Link
          key={label}
          href={href(projectId)}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-xs font-medium",
            "text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
