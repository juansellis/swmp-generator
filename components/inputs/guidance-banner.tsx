"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GuidanceBannerProps {
  /** Section is complete; show confirmation line instead of next-step banner */
  complete: boolean;
  /** When incomplete: "Next Step: {nextStepLabel}" */
  nextStepLabel?: string;
  /** When incomplete: short helper text (why this matters for SWMP compliance) */
  helperText?: string;
  /** When incomplete: CTA button label (e.g. "Add waste stream") */
  ctaLabel?: string;
  /** When incomplete: CTA click (e.g. scroll to next required field) */
  onCta?: () => void;
  className?: string;
}

/**
 * In-section guidance: shows "Next Step" + CTA when incomplete, or subtle green confirmation when complete.
 */
export function GuidanceBanner({
  complete,
  nextStepLabel,
  helperText,
  ctaLabel,
  onCta,
  className,
}: GuidanceBannerProps) {
  if (complete) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200",
          className
        )}
      >
        <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span>This step is complete. You can still edit below.</span>
      </div>
    );
  }

  if (!nextStepLabel && !ctaLabel) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 space-y-2",
        className
      )}
    >
      <p className="font-medium text-foreground">
        Next step: {nextStepLabel ?? "Complete this section"}
      </p>
      {helperText ? (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      ) : null}
      {ctaLabel && onCta ? (
        <Button type="button" size="sm" onClick={onCta}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
