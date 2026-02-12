"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProjectContext } from "@/app/projects/[id]/project-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Project page header: back button, project title line, and section tabs.
 * Tabs use pill style; max width aligned with page container. Not in global nav.
 */
export function ProjectHeader() {
  const pathname = usePathname();
  const ctx = useProjectContext();
  const projectId = ctx?.projectId ?? null;
  const project = ctx?.project ?? null;
  const forecastCount = ctx?.forecastCount ?? 0;

  if (!projectId) return null;

  const base = `/projects/${projectId}`;
  const isInputs = pathname === `${base}/inputs` || pathname === base;
  const isForecast = pathname === `${base}/forecast`;
  const isOutputs = pathname === `${base}/swmp`;

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Button
            variant="outline"
            size="default"
            asChild
            className="shrink-0"
          >
            <Link href="/projects">← Back to projects</Link>
          </Button>
        </div>
        {project && (
          <p className="text-sm text-muted-foreground">
            Project: <strong className="text-foreground">{project.name}</strong>
            {project.address ? ` • ${project.address}` : ""}
          </p>
        )}
        <nav
          className={cn(
            "mt-2 mb-4 rounded-lg bg-muted p-[3px] w-fit inline-flex h-9 items-center justify-center text-muted-foreground"
          )}
          aria-label="Project sections"
        >
          <Link
            href={`${base}/inputs`}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isInputs
                ? "bg-background text-foreground shadow-sm dark:bg-input/30 dark:border-input"
                : "text-foreground/60 dark:text-muted-foreground dark:hover:text-foreground"
            )}
          >
            Inputs
          </Link>
          <Link
            href={`${base}/forecast`}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isForecast
                ? "bg-background text-foreground shadow-sm dark:bg-input/30 dark:border-input"
                : "text-foreground/60 dark:text-muted-foreground dark:hover:text-foreground"
            )}
          >
            Forecast
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs tabular-nums ml-0.5">
              {forecastCount}
            </Badge>
          </Link>
          <Link
            href={`${base}/swmp`}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isOutputs
                ? "bg-background text-foreground shadow-sm dark:bg-input/30 dark:border-input"
                : "text-foreground/60 dark:text-muted-foreground dark:hover:text-foreground"
            )}
          >
            Outputs
          </Link>
        </nav>
      </div>
    </div>
  );
}
