"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type InputsSectionAccent = "slate" | "blue" | "amber" | "green" | "purple";

const ACCENT_BAR_CLASSES: Record<InputsSectionAccent, string> = {
  slate: "border-l-slate-500/60",
  blue: "border-l-blue-500/70",
  amber: "border-l-amber-500/70",
  green: "border-l-emerald-500/70",
  purple: "border-l-purple-500/70",
};

export interface InputsSectionProps {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  accentColor?: InputsSectionAccent;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function InputsSection({
  id,
  title,
  description,
  accentColor = "slate",
  actions,
  children,
  className,
}: InputsSectionProps) {
  const accentBar = ACCENT_BAR_CLASSES[accentColor];
  return (
    <Card
      id={id}
      className={cn(
        "rounded-xl border-l-[3px] border-border/50 shadow-sm overflow-hidden",
        accentBar,
        className
      )}
    >
      <CardHeader className="pb-2 space-y-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-0">{children}</CardContent>
    </Card>
  );
}
