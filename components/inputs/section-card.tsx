"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
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

export interface InputsSectionCardProps {
  id?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  accent?: SectionAccent;
  actions?: React.ReactNode;
  /** Optional completion for progress indicator (e.g. { completed: 3, total: 6 }) */
  completion?: { completed: number; total: number };
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
  accent = "zinc",
  actions,
  completion,
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
          "rounded-xl border border-border/50 overflow-hidden",
          "border-l-4",
          accentBarClass,
          "bg-card shadow-sm",
          className
        )}
      >
        <div className="bg-muted/40 px-6 py-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              {icon ? <span className={cn("shrink-0 mt-0.5", iconClass)}>{icon}</span> : null}
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
                  {completion ? (
                    <CompletionProgress
                      completed={completion.completed}
                      total={completion.total}
                      showLabel={true}
                      size="sm"
                    />
                  ) : null}
                </div>
                {description ? (
                  <p className="text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </div>
        <div className={cn("px-6 py-6", contentClassName)}>{children}</div>
      </section>
    );
  }

  return (
    <section
      id={id}
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm overflow-hidden",
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {completion ? (
                  <CompletionProgress
                    completed={completion.completed}
                    total={completion.total}
                    showLabel={true}
                    size="sm"
                  />
                ) : null}
              </div>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className={cn("px-6 py-6", contentClassName)}>{children}</div>
    </section>
  );
}
