"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CompletionProgress } from "@/components/completion-progress";
import { PlanSectionHeader, type PlanSectionStatus } from "@/components/plan-section-header";
import type { StepStatusBadge } from "./section-card";
import type { SectionAccent } from "./section-card";

function stepStatusToPlanStatus(step: StepStatusBadge | undefined): PlanSectionStatus | undefined {
  if (!step) return undefined;
  if (step === "complete") return "complete";
  if (step === "attention") return "needs_attention";
  return "not_started";
}

export interface CollapsibleSectionCardProps {
  /** Section id – must match Accordion value and STEP_SECTION_IDS */
  id: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  whyMatters?: React.ReactNode;
  accent?: SectionAccent;
  completion?: { completed: number; total: number };
  stepStatusBadge?: StepStatusBadge;
  checklist?: string[];
  guidance?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  /** Primary focus section (e.g. Waste Streams): thicker border + green accent */
  variant?: "default" | "grouped" | "primary";
}

const ACCENT_BAR: Record<SectionAccent, string> = {
  emerald: "border-l-emerald-500/70",
  blue: "border-l-blue-500/70",
  amber: "border-l-amber-500/70",
  purple: "border-l-purple-500/70",
  zinc: "border-l-zinc-400/60",
  green: "border-l-emerald-500/70",
};

export function CollapsibleSectionCard({
  id,
  icon,
  title,
  description,
  whyMatters,
  accent = "zinc",
  completion,
  stepStatusBadge,
  checklist,
  guidance,
  footer,
  children,
  contentClassName,
  variant = "default",
}: CollapsibleSectionCardProps) {
  const hasExtra = whyMatters || (checklist && checklist.length > 0) || completion;
  const accentBar = ACCENT_BAR[accent];
  const isPrimary = variant === "primary";

  return (
    <AccordionItem
      value={id}
      className={cn(
        "rounded-xl border border-border/50 bg-card overflow-hidden transition-shadow",
        isPrimary && "border-2 border-l-4 border-l-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/20",
        !isPrimary && variant === "grouped" && "border-l-4 " + accentBar
      )}
    >
      <AccordionTrigger className="rounded-t-xl px-4 py-2.5 hover:bg-muted/40 hover:no-underline [&>span:last-child]:shrink-0">
        <span className="flex flex-1 items-center gap-3 min-w-0 text-left">
          <PlanSectionHeader
            icon={icon}
            title={title}
            description={description}
            status={stepStatusToPlanStatus(stepStatusBadge)}
            sticky={false}
            className="border-0 border-b-0 bg-transparent p-0 py-0 min-h-0 shadow-none"
          />
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-5 pt-0">
        {hasExtra ? (
          <div className="border-b border-border/50 bg-muted/30 -mx-4 px-4 py-2 mb-4">
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
        {guidance ? <div className="mb-3">{guidance}</div> : null}
        <div className={cn("space-y-4", contentClassName)}>
          {children}
        </div>
        {footer ? (
          <div className="mt-5 pt-3 border-t border-border/50 flex flex-wrap items-center gap-2">
            {footer}
          </div>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}
