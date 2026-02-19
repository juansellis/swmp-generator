"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface InfoTipProps {
  /** Short label for aria (e.g. "Help" or context). */
  label: string;
  /** Tooltip/popover content. Plain text or short JSX. */
  content: React.ReactNode;
  /** "tooltip" = hover only; "popover" = click to open (better for touch). */
  variant?: "tooltip" | "popover";
  /** Optional class for the trigger button. */
  className?: string;
}

/**
 * Small "?" icon that shows contextual help on hover (tooltip) or click (popover).
 * Use for key buttons/options on the Inputs page.
 */
export function InfoTip({
  label,
  content,
  variant = "tooltip",
  className,
}: InfoTipProps) {
  const trigger = (
    <button
      type="button"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label={label}
    >
      <HelpCircle className="size-3.5" aria-hidden />
    </button>
  );

  if (variant === "popover") {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent side="top" align="end" className="max-w-[280px] text-sm">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-[260px]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
