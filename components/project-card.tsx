"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusPills } from "@/components/project-status-pills";
import { ProjectHealthBadge } from "@/components/project-status-pill";
import type { ProjectStatusData } from "@/lib/projectStatus";
import { MapPin, Calendar } from "lucide-react";

export interface ProjectCardProps {
  id: string;
  name: string;
  address?: string | null;
  region?: string | null;
  project_type?: string | null;
  created_at: string;
  status: ProjectStatusData;
  onOpen: () => void;
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
  className,
}: ProjectCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm overflow-hidden",
        "hover:border-primary/30 hover:shadow-md transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "cursor-pointer text-left",
        className
      )}
      aria-label={`Open project ${name}`}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base truncate flex-1">{name}</h3>
          <ProjectHealthBadge status={status} showScore={true} />
        </div>
        {address ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{address}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {region ? (
            <Badge variant="secondary" className="font-normal">
              {region}
            </Badge>
          ) : null}
          {project_type ? (
            <Badge variant="outline" className="font-normal">
              {project_type}
            </Badge>
          ) : null}
        </div>
        <div className="pt-1">
          <ProjectStatusPills status={status} showLabels={true} />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="size-3" />
            {new Date(created_at).toLocaleDateString()}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            Open
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
