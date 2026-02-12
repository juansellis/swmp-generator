"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export interface FieldGroupProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  gridClassName?: string;
}

export function FieldGroup({
  label,
  description,
  children,
  className,
  gridClassName = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6",
}: FieldGroupProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {label != null && (
        <div className="space-y-1">
          {typeof label === "string" ? (
            <Label className="text-sm font-medium">{label}</Label>
          ) : (
            label
          )}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}
      <div className={cn(gridClassName)}>{children}</div>
    </div>
  );
}
