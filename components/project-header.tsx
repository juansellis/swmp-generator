"use client";

import * as React from "react";
import Link from "next/link";
import { useProjectContext } from "@/app/projects/[id]/project-context";
import { Button } from "@/components/ui/button";
import { PhaseTabs } from "@/components/phase-tabs";

/**
 * Project page header: back button, project title line, and phase tabs.
 * Phase tabs are route-driven (pathname only); no local phase state.
 */
export function ProjectHeader() {
  const ctx = useProjectContext();
  const projectId = ctx?.projectId ?? null;
  const project = ctx?.project ?? null;
  const forecastCount = ctx?.forecastCount ?? 0;

  if (!projectId) return null;

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
        <PhaseTabs projectId={projectId} forecastCount={forecastCount} className="mt-2 mb-4" />
      </div>
    </div>
  );
}
