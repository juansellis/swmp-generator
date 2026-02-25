"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectStatusData } from "@/lib/projectStatus";
import type { PlanningChecklist } from "@/lib/planning/planningChecklist";
import { MapPin, MoreVertical, FolderOpen, Trash2, Loader2 } from "lucide-react";

export type ReportStatusValue = "in_progress" | "sent_for_review" | "declined" | "approved";

const REPORT_STATUS_LABELS: Record<ReportStatusValue, string> = {
  in_progress: "In progress",
  sent_for_review: "Sent for review",
  declined: "Declined",
  approved: "Approved",
};

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
  /** Current report status; shown as badge + select. Defaults to "in_progress" if missing. */
  reportStatus?: ReportStatusValue | null;
  /** Called when user changes report status. Parent should persist and call on failure with error message. */
  onReportStatusChange?: (projectId: string, value: ReportStatusValue) => Promise<void>;
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
  reportStatus,
  onReportStatusChange,
  className,
}: ProjectCardProps) {
  const readiness = checklist?.readiness_score ?? null;
  const nextAction = checklist?.next_best_action;
  const effectiveStatus: ReportStatusValue = reportStatus && ["in_progress", "sent_for_review", "declined", "approved"].includes(reportStatus)
    ? reportStatus
    : "in_progress";
  const [statusSaving, setStatusSaving] = React.useState(false);
  const [localStatus, setLocalStatus] = React.useState<ReportStatusValue>(effectiveStatus);

  React.useEffect(() => {
    setLocalStatus(effectiveStatus);
  }, [effectiveStatus]);

  const handleStatusChange = async (value: ReportStatusValue) => {
    if (!onReportStatusChange || value === localStatus) return;
    setLocalStatus(value);
    setStatusSaving(true);
    try {
      await onReportStatusChange(id, value);
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden text-left",
        "transition-all duration-200 hover:scale-[1.01] hover:shadow-md hover:border-border",
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0" title={address}>
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
              <Badge
                variant="secondary"
                className={cn(
                  "shrink-0 ml-2 tabular-nums",
                  readiness >= 80 && "bg-green-500/15 text-green-700 border-green-500/40 dark:text-green-400 dark:border-green-500/40",
                  readiness >= 40 && readiness < 80 && "bg-blue-500/15 text-blue-700 border-blue-500/40 dark:text-blue-400 dark:border-blue-500/40",
                  readiness < 40 && "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-400 dark:border-amber-500/40"
                )}
              >
                {readiness}%
              </Badge>
            </div>
            <Progress value={readiness} className="h-1.5 mt-2" />
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

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground shrink-0">Status</p>
          <Select
            value={localStatus}
            onValueChange={(v) => handleStatusChange(v as ReportStatusValue)}
            disabled={statusSaving}
          >
            <SelectTrigger
              className="h-8 w-[140px] text-xs shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {statusSaving ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  Saving…
                </span>
              ) : (
                <SelectValue placeholder="Status" />
              )}
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {(["in_progress", "sent_for_review", "declined", "approved"] as const).map((val) => (
                <SelectItem key={val} value={val}>
                  {REPORT_STATUS_LABELS[val]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
