"use client";

import * as React from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, AlertCircle, Circle } from "lucide-react";
import type { BuilderStepProgress } from "@/lib/swmpBuilder";
import { STEP_SECTION_IDS, type BuilderStepId } from "@/lib/swmpBuilder";

const STICKY_TOP_OFFSET = 96;

export interface BuilderProgressRailProps {
  progress: BuilderStepProgress[];
  onStepClick?: (sectionId: string) => void;
  className?: string;
  /** Show as compact dropdown on small screens */
  variant?: "rail" | "bar";
}

export function BuilderProgressRail({
  progress,
  onStepClick,
  className,
  variant = "rail",
}: BuilderProgressRailProps) {
  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);

  const handleClick = (stepId: BuilderStepId) => {
    const sectionId = STEP_SECTION_IDS[stepId];
    if (onStepClick) {
      onStepClick(sectionId);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - STICKY_TOP_OFFSET;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    const sectionIds = progress.map((p) => STEP_SECTION_IDS[p.stepId]);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: `-${STICKY_TOP_OFFSET + 80}px 0px -60% 0px`, threshold: 0 }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [progress.length]);

  if (variant === "bar") {
    return (
      <nav
        aria-label="Plan Builder"
        className={cn("flex flex-wrap items-center gap-1", className)}
      >
        {progress.map((step, i) => (
          <React.Fragment key={step.stepId}>
            {i > 0 && <span className="text-muted-foreground/50">/</span>}
            <button
              type="button"
              onClick={() => handleClick(step.stepId)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors",
                step.status === "complete" && "text-muted-foreground hover:text-foreground",
                (step.status === "not_started" || step.status === "recommendedNext") &&
                  "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                step.status === "recommendedNext" && "bg-primary/10 text-primary font-medium"
              )}
            >
              {step.status === "complete" ? (
                <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : step.status === "recommendedNext" ? (
                <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              ) : (
                <Circle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>{step.label}</span>
            </button>
          </React.Fragment>
        ))}
      </nav>
    );
  }

  return (
    <nav
        aria-label="Plan Builder"
        className={cn("sticky z-10 space-y-0.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80", className)}
        style={{ top: STICKY_TOP_OFFSET }}
      >
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-3">
          Plan Builder
        </p>
        <ul className="space-y-0.5">
          {progress.map((step) => {
            const sectionId = STEP_SECTION_IDS[step.stepId];
            const isActive = activeSectionId === sectionId;
            return (
              <li key={step.stepId}>
                <button
                  type="button"
                  onClick={() => handleClick(step.stepId)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    isActive && "bg-primary/10 text-primary font-medium",
                    step.status === "complete" &&
                      !isActive &&
                      "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    (step.status === "not_started" || step.status === "recommendedNext") &&
                      !isActive &&
                      "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    step.status === "recommendedNext" && !isActive && "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  )}
                >
                  {step.status === "complete" ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" aria-hidden />
                    </span>
                  ) : step.status === "recommendedNext" ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="size-3" aria-hidden />
                    </span>
                  ) : (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Circle className="size-2.5" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 truncate">{step.label}</span>
                  {step.status === "recommendedNext" && (
                    <span className="ml-auto shrink-0 text-xs font-normal text-amber-600 dark:text-amber-400">
                      Next
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
    </nav>
  );
}
