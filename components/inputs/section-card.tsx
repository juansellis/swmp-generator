"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CompletionProgress } from "@/components/completion-progress";

export type SectionAccent = "emerald" | "blue" | "amber" | "purple" | "zinc";

const ACCENT_CLASSES: Record<SectionAccent, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
  purple: "text-purple-600 dark:text-purple-400",
  zinc: "text-zinc-600 dark:text-zinc-400",
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
}: InputsSectionCardProps) {
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
              <span className={cn("shrink-0 mt-0.5", ACCENT_CLASSES[accent])}>
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
