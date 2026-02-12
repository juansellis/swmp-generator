"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2Icon, CheckIcon } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface StickyActionBarProps {
  saveState: SaveState;
  onSave: () => void;
  saveLabel?: string;
  /** Optional secondary action (e.g. Generate SWMP) */
  secondaryAction?: React.ReactNode;
  /** Last saved timestamp for display */
  lastSavedAt?: Date | null;
  disabled?: boolean;
  className?: string;
}

export function StickyActionBar({
  saveState,
  onSave,
  saveLabel = "Save Inputs",
  secondaryAction,
  lastSavedAt,
  disabled,
  className,
}: StickyActionBarProps) {
  const indicator =
    saveState === "saving" ? (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Saving…
      </span>
    ) : saveState === "saved" ? (
      <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckIcon className="size-4" />
        {lastSavedAt
          ? `Saved ${lastSavedAt.toLocaleTimeString()}`
          : "Saved"}
      </span>
    ) : saveState === "error" ? (
      <span className="text-sm text-destructive">Save failed</span>
    ) : (
      <span className="text-sm text-muted-foreground">Unsaved changes</span>
    );

  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-border bg-background/95 backdrop-blur px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {indicator}
      </div>
      <div className="flex items-center gap-2">
        {secondaryAction}
        <Button
          type="button"
          variant="primary"
          size="default"
          onClick={onSave}
          disabled={disabled || saveState === "saving"}
        >
          {saveState === "saving" ? (
            <>
              <Loader2Icon className="size-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            saveLabel
          )}
        </Button>
      </div>
    </div>
  );
}
