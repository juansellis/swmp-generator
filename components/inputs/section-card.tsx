"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CompletionProgress } from "@/components/completion-progress";
import { PlanSectionHeader, type PlanSectionStatus } from "@/components/plan-section-header";

export type SectionAccent = "emerald" | "blue" | "amber" | "purple" | "zinc" | "green";

const ACCENT_BAR_CLASSES: Record<SectionAccent, string> = {
  emerald: "border-l-emerald-500/70",
  blue: "border-l-blue-500/70",
  amber: "border-l-amber-500/70",
  purple: "border-l-purple-500/70",
  zinc: "border-l-zinc-400/60",
  green: "border-l-emerald-500/70",
};

export type StepStatusBadge = "complete" | "attention" | "not_started";

function stepStatusToPlanStatus(step: StepStatusBadge | undefined): PlanSectionStatus | undefined {
  if (!step) return undefined;
  if (step === "complete") return "complete";
  if (step === "attention") return "needs_attention";
  return "not_started";
}

export interface InputsSectionCardProps {
  id?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Short "Why this matters" line */
  whyMatters?: React.ReactNode;
  accent?: SectionAccent;
  actions?: React.ReactNode;
  /** Optional completion for progress indicator (e.g. { completed: 3, total: 6 }) */
  completion?: { completed: number; total: number };
  /** Plan Builder step status for badge (Complete / Needs attention / Not started) */
  stepStatusBadge?: StepStatusBadge;
  /** 2–4 bullets describing what "complete" means for this step */
  checklist?: string[];
  /** Footer CTA and helper text (e.g. Save & continue + "You can come back and edit later") */
  footer?: React.ReactNode;
  /** Optional guidance banner (Next Step / completion line) at top of body */
  guidance?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** When true, uses muted header with left accent bar (premium section style) */
  variant?: "default" | "grouped";
}

export function InputsSectionCard({
  id,
  icon,
  title,
  description,
  whyMatters,
  accent = "zinc",
  actions,
  completion,
  stepStatusBadge,
  checklist,
  footer,
  guidance,
  children,
  className,
  contentClassName,
  variant = "default",
}: InputsSectionCardProps) {
  const accentBarClass = ACCENT_BAR_CLASSES[accent];
  const hasExtra = whyMatters || (checklist && checklist.length > 0) || completion;

  const headerArea = (
    <>
      <PlanSectionHeader
        id={id}
        icon={icon ?? <span className="size-5" aria-hidden />}
        title={title}
        description={description}
        status={stepStatusToPlanStatus(stepStatusBadge)}
        actions={actions}
        sticky={true}
        className={variant === "grouped" ? "bg-muted/40 rounded-t-xl" : "bg-card"}
      />
      {hasExtra ? (
        <div className="border-b border-border/50 bg-muted/30 px-4 py-2">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {completion ? (
              <CompletionProgress
                completed={completion.completed}
                total={completion.total}
                showLabel={true}
                size="sm"
              />
            ) : null}
            {whyMatters ? <span>{whyMatters}</span> : null}
            {checklist && checklist.length > 0 ? (
              <ul className="list-disc list-inside space-y-0.5">
                {checklist.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );

  const contentArea = (
    <div className={cn("px-5 py-5", contentClassName)}>
      {guidance ? <div className="mb-3">{guidance}</div> : null}
      {children}
      {footer ? (
        <div className="mt-5 pt-3 border-t border-border/50 flex flex-wrap items-center gap-2">
          {footer}
        </div>
      ) : null}
    </div>
  );

  if (variant === "grouped") {
    return (
      <section
        id={id}
        className={cn(
          "rounded-xl border border-border/50 overflow-hidden border-l-4",
          accentBarClass,
          "bg-card transition-shadow hover:shadow-sm",
          className
        )}
      >
        {headerArea}
        {contentArea}
      </section>
    );
  }

  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border border-border/50 bg-card overflow-hidden transition-shadow hover:shadow-sm",
        className
      )}
    >
      {headerArea}
      {contentArea}
    </section>
  );
}
