"use client";

import { cn } from "@/lib/utils";
import { InfoIcon } from "lucide-react";

export interface SmartHintProps {
  message: string;
  variant?: "info" | "warning" | "success";
  className?: string;
  icon?: boolean;
}

const variantClasses = {
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
};

export function SmartHint({
  message,
  variant = "info",
  className,
  icon = true,
}: SmartHintProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        variantClasses[variant],
        className
      )}
      role="status"
    >
      {icon ? <InfoIcon className="size-4 shrink-0 mt-0.5" /> : null}
      <span>{message}</span>
    </div>
  );
}
