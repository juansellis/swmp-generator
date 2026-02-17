"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface TextareaFieldWrapperProps {
  id?: string;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  maxWidth?: "max-w-2xl" | "max-w-3xl" | "full";
  className?: string;
  textareaClassName?: string;
  children?: React.ReactNode;
  /** When provided, renders a controlled Textarea with value/onChange; otherwise children (e.g. raw Textarea) */
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export function TextareaFieldWrapper({
  id,
  label,
  helperText,
  maxWidth = "max-w-3xl",
  className,
  textareaClassName,
  children,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
}: TextareaFieldWrapperProps) {
  const content =
    children ??
    (value !== undefined && onChange ? (
      <Textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={cn(
          "bg-muted/30 rounded-lg focus:ring-2 focus:ring-primary/20 border-border",
          textareaClassName
        )}
      />
    ) : null);

  return (
    <div className={cn("space-y-2", maxWidth !== "full" && maxWidth, className)}>
      {label != null && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      )}
      {helperText != null && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
      {content}
    </div>
  );
}
