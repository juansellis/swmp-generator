"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type PlanningSectionVariant = "inputs" | "planning" | "outputs" | "strategy";

const BORDER_CLASS: Record<PlanningSectionVariant, string> = {
  inputs: "border-l-blue-400",
  planning: "border-l-indigo-400",
  outputs: "border-l-emerald-400",
  strategy: "border-l-amber-400",
};

export interface PlanningSectionProps {
  variant: PlanningSectionVariant;
  title: React.ReactNode;
  helperText?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PlanningSection({
  variant,
  title,
  helperText,
  children,
  className,
}: PlanningSectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm p-6 pl-7 border-l-4",
        BORDER_CLASS[variant],
        className
      )}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {helperText && (
          <p className="text-sm text-muted-foreground mt-1">{helperText}</p>
        )}
      </div>
      {children}
    </section>
  );
}
