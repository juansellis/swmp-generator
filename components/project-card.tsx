"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusPills } from "@/components/project-status-pills";
import { ProjectHealthBadge } from "@/components/project-status-pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectStatusData } from "@/lib/projectStatus";
import type { PlanningChecklist } from "@/lib/planning/planningChecklist";
import { MapPin, MoreVertical, FolderOpen, Trash2 } from "lucide-react";

export interface ProjectCardProps {
  id: string;
  name: string;
  address?: string | null;
  region?: string | null;
  project_type?: string | null;
  created_at: string;
  status: ProjectStatusData;
  onOpen: () => void;
  /** When provided, shows planning readiness % and next best action. */
  checklist?: PlanningChecklist | null;
  /** When provided, shows "Delete project" in dropdown and calls this with { id, name }. */
  onDeleteRequest?: (project: { id: string; name: string }) => void;
  className?: string;
}

export function ProjectCard({
  id,
  name,
  address,
  region,
  project_type,
  created_at,
  status,
  onOpen,
  checklist,
  onDeleteRequest,
  className,
}: ProjectCardProps) {
  const readiness = checklist?.readiness_score ?? null;
  const nextAction = checklist?.next_best_action;

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden text-left",
        "hover:border-border hover:shadow-sm transition-all duration-200",
        "flex flex-col",
        className
      )}
    >
      <div className="p-5 space-y-4 flex-1 flex flex-col min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base truncate flex-1 leading-tight">{name}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 rounded-md"
                onClick={(e) => e.stopPropagation()}
                aria-label="More actions"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(); }}>
                <FolderOpen className="size-4 mr-2" />
                Open project
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/projects/${id}/inputs`} onClick={(e) => e.stopPropagation()}>
                  Go to inputs
                </Link>
              </DropdownMenuItem>
              {onDeleteRequest && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRequest({ id, name });
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete project
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {address ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground/80" />
            <span className="truncate">{address}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {region ? (
            <Badge variant="secondary" className="font-normal text-xs">
              {region}
            </Badge>
          ) : null}
          {project_type ? (
            <Badge variant="outline" className="font-normal text-xs">
              {project_type}
            </Badge>
          ) : null}
        </div>

        {readiness != null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Planning readiness</span>
              <ProjectHealthBadge status={status} showScore={true} className="shrink-0 ml-2" />
            </div>
            <div
              className="h-2 w-full rounded-full bg-muted/80 overflow-hidden"
              role="progressbar"
              aria-valuenow={readiness}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary/80 transition-all"
                style={{ width: `${readiness}%` }}
              />
            </div>
            {nextAction && (nextAction.href || nextAction.label) && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full text-xs h-8"
                asChild
              >
                <Link
                  href={nextAction.href ?? `/projects/${id}/inputs`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {nextAction.label}
                </Link>
              </Button>
            )}
          </div>
        )}

        <div className="pt-0.5">
          <ProjectStatusPills status={status} showLabels={true} />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-border/50 flex items-center justify-between gap-3 bg-muted/20">
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(created_at).toLocaleDateString()}
        </span>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Open
        </Button>
      </div>
    </motion.article>
  );
}
