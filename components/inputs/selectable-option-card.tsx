"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface SelectableOptionCardProps {
  checked: boolean;
  onCheckedChange: () => void;
  icon?: React.ReactNode;
  label: React.ReactNode;
  accentColor?: "blue" | "slate";
  disabled?: boolean;
  className?: string;
}

export function SelectableOptionCard({
  checked,
  onCheckedChange,
  icon,
  label,
  accentColor = "blue",
  disabled,
  className,
}: SelectableOptionCardProps) {
  const accentBorder = accentColor === "blue"
    ? "border-blue-500/80 ring-2 ring-blue-500/20"
    : "border-slate-500/60 ring-2 ring-slate-500/15";

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={checked}
      onClick={() => !disabled && onCheckedChange()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!disabled) onCheckedChange();
        }
      }}
      className={cn(
        "cursor-pointer transition-all rounded-lg border-2",
        checked ? accentBorder : "border-border/50 hover:border-border hover:bg-muted/30",
        disabled && "opacity-60 pointer-events-none",
        className
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
        <span className="text-sm font-medium">{label}</span>
      </CardContent>
    </Card>
  );
}
