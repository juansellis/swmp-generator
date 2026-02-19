"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, AlertCircle, Circle, ChevronDown, ClipboardCheck } from "lucide-react";
import { InfoTip } from "@/components/inputs/info-tip";
import { cn } from "@/lib/utils";
import type { BuilderStepProgress } from "@/lib/swmpBuilder";
import { STEP_SECTION_IDS, type BuilderStepId } from "@/lib/swmpBuilder";

const STICKY_TOP_OFFSET = 96;
const TOTAL_STEPS = 6;

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - STICKY_TOP_OFFSET;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }
}

export interface BuilderHeaderProps {
  /** Progress array from computeBuilderProgress */
  progress: BuilderStepProgress[];
  /** Number of complete steps (e.g. countCompleteSteps(progress)) */
  completeCount: number;
  /** Callback when user clicks Continue: scrolls to next incomplete step */
  onContinue?: () => void;
  /** Callback for Apply recommended SWMP content */
  onApplyTemplate?: () => void;
  /** Whether Apply button is disabled */
  applyTemplateDisabled?: boolean;
  /** Whether to show Apply button */
  showApplyTemplate?: boolean;
  className?: string;
}

export function BuilderHeader({
  progress,
  completeCount,
  onContinue,
  onApplyTemplate,
  applyTemplateDisabled = false,
  showApplyTemplate = false,
  className,
}: BuilderHeaderProps) {
  const nextStep = progress.find((p) => p.status === "recommendedNext");
  const nextLabel = nextStep?.label ?? "Review & generate";
  const nextSectionId = nextStep ? STEP_SECTION_IDS[nextStep.stepId] : null;

  const handleContinue = () => {
    if (nextSectionId) scrollToSection(nextSectionId);
    onContinue?.();
  };

  const handleStepClick = (stepId: BuilderStepId) => {
    scrollToSection(STEP_SECTION_IDS[stepId]);
  };

  const value = Math.min(TOTAL_STEPS, Math.max(0, completeCount));
  const pct = TOTAL_STEPS > 0 ? (value / TOTAL_STEPS) * 100 : 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-card px-4 py-3 shadow-sm",
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4",
        className
      )}
      role="region"
      aria-label="Plan Builder progress"
    >
      {/* Progress summary + bar */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular-nums text-foreground">
            {completeCount}/{TOTAL_STEPS} complete
          </span>
          <div
            className="h-1.5 flex-1 min-w-[80px] max-w-[120px] overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={TOTAL_STEPS}
            aria-label={`${completeCount} of ${TOTAL_STEPS} steps complete`}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {nextSectionId && (
          <button
            type="button"
            onClick={handleContinue}
            className="text-left text-sm text-muted-foreground hover:text-foreground hover:underline focus:outline-none focus:underline"
          >
            Next: {nextLabel}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={handleContinue} size="sm" className="gap-1.5">
          Continue
        </Button>
        {showApplyTemplate && (
          <span className="inline-flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onApplyTemplate}
              disabled={applyTemplateDisabled}
              className="gap-1.5"
            >
              <ClipboardCheck className="size-4 shrink-0" aria-hidden />
              Apply recommended content
            </Button>
            <InfoTip
              label="Apply recommended content help"
              content="Fills blank text only (site controls, monitoring, responsibilities, notes). Doesn’t overwrite anything you’ve already entered."
              variant="tooltip"
            />
          </span>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5">
              All steps
              <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="end">
            <nav aria-label="All plan steps">
              <ul className="space-y-0.5">
                {progress.map((step) => {
                  const sectionId = STEP_SECTION_IDS[step.stepId];
                  return (
                    <li key={step.stepId}>
                      <button
                        type="button"
                        onClick={() => handleStepClick(step.stepId)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                          "hover:bg-muted focus:bg-muted focus:outline-none",
                          step.status === "complete" && "text-muted-foreground",
                          step.status === "recommendedNext" && "font-medium text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {step.status === "complete" ? (
                          <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        ) : step.status === "recommendedNext" ? (
                          <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                        ) : (
                          <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        )}
                        <span className="min-w-0 truncate">{step.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
