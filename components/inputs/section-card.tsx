"use client";

import * as React from "react";
import { Check, AlertCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CompletionProgress } from "@/components/completion-progress";

export type SectionAccent = "emerald" | "blue" | "amber" | "purple" | "zinc" | "green";

const ACCENT_CLASSES: Record<SectionAccent, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
  purple: "text-purple-600 dark:text-purple-400",
  zinc: "text-zinc-600 dark:text-zinc-400",
  green: "text-emerald-600 dark:text-emerald-400",
};

const ACCENT_BAR_CLASSES: Record<SectionAccent, string> = {
  emerald: "border-l-emerald-500/70",
  blue: "border-l-blue-500/70",
  amber: "border-l-amber-500/70",
  purple: "border-l-purple-500/70",
  zinc: "border-l-zinc-400/60",
  green: "border-l-emerald-500/70",
};

export type StepStatusBadge = "complete" | "attention" | "not_started";

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

function StatusBadge({ status }: { status: StepStatusBadge }) {
  if (status === "complete") {
    return (
      <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
        <Check className="size-3" /> Complete
      </Badge>
    );
  }
  if (status === "attention") {
    return (
      <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
        <AlertCircle className="size-3" /> Needs attention
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-muted-foreground">
      <Circle className="size-3" /> Not started
    </Badge>
  );
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
  const iconClass = ACCENT_CLASSES[accent];

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
        <div className="bg-muted/40 px-6 py-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {icon ? <span className={cn("shrink-0 mt-0.5", iconClass)}>{icon}</span> : null}
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
                  {completion ? (
                    <CompletionProgress
                      completed={completion.completed}
                      total={completion.total}
                      showLabel={true}
                      size="sm"
                    />
                  ) : null}
                  {stepStatusBadge ? <StatusBadge status={stepStatusBadge} /> : null}
                </div>
                {description ? (
                  <p className="text-sm text-muted-foreground">{description}</p>
                ) : null}
                {whyMatters ? (
                  <p className="text-xs text-muted-foreground/90">{whyMatters}</p>
                ) : null}
                {checklist && checklist.length > 0 ? (
                  <ul className="text-xs text-muted-foreground list-disc list-inside mt-1.5 space-y-0.5">
                    {checklist.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </div>
        <div className={cn("px-6 py-6", contentClassName)}>
          {guidance ? <div className="mb-4">{guidance}</div> : null}
          {children}
          {footer ? (
            <div className="mt-6 pt-4 border-t border-border/50 flex flex-wrap items-center gap-2">
              {footer}
            </div>
          ) : null}
        </div>
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
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {icon ? (
              <span className={cn("shrink-0 mt-0.5", iconClass)}>
                {icon}
              </span>
            ) : null}
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {completion ? (
                  <CompletionProgress
                    completed={completion.completed}
                    total={completion.total}
                    showLabel={true}
                    size="sm"
                  />
                ) : null}
                {stepStatusBadge ? <StatusBadge status={stepStatusBadge} /> : null}
              </div>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
              {whyMatters ? (
                <p className="text-xs text-muted-foreground/90">{whyMatters}</p>
              ) : null}
              {checklist && checklist.length > 0 ? (
                <ul className="text-xs text-muted-foreground list-disc list-inside mt-1.5 space-y-0.5">
                  {checklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className={cn("px-6 py-6", contentClassName)}>
        {guidance ? <div className="mb-4">{guidance}</div> : null}
        {children}
        {footer ? (
          <div className="mt-6 pt-4 border-t border-border/50">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}
