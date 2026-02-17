"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface EditableFieldWrapperProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Optional grid gap for inner layout */
  contentClassName?: string;
}

/**
 * Wraps a field (Input/Select/Textarea) with consistent spacing and optional hover affordance.
 * Does not change validation or behaviour — presentation only.
 */
export function EditableFieldWrapper({
  label,
  hint,
  children,
  className,
  contentClassName,
}: EditableFieldWrapperProps) {
  return (
    <div
      className={cn(
        "group space-y-2 rounded-lg transition-colors",
        "focus-within:bg-muted/20 hover:bg-muted/10",
        className
      )}
    >
      {label ? (
        <label className="block text-sm font-medium text-foreground">{label}</label>
      ) : null}
      <div className={cn("min-h-9", contentClassName)}>{children}</div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
