"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Loader2Icon, CheckIcon, AlertCircleIcon } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface InputsPageHeaderProps {
  /** Breadcrumb: e.g. ["Projects", projectName, "Inputs"] */
  breadcrumb?: { label: string; href?: string }[];
  /** Main page title (e.g. "Inputs") */
  title: string;
  /** Optional subtitle (e.g. status pills) */
  subtitle?: React.ReactNode;
  /** Autosave/save state for indicator */
  saveState?: SaveState;
  /** Last saved time for "Saved at HH:MM" */
  lastSavedAt?: Date | null;
  /** Optional actions (e.g. dropdown menu) */
  actions?: React.ReactNode;
  className?: string;
}

export function InputsPageHeader({
  breadcrumb,
  title,
  subtitle,
  saveState = "idle",
  lastSavedAt,
  actions,
  className,
}: InputsPageHeaderProps) {
  const saveIndicator =
    saveState === "saving" ? (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
        <Loader2Icon className="size-4 animate-spin shrink-0" />
        Saving…
      </span>
    ) : saveState === "saved" ? (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckIcon className="size-4 shrink-0" />
        {lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "Saved"}
      </span>
    ) : saveState === "error" ? (
      <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
        <AlertCircleIcon className="size-4 shrink-0" />
        Save failed
      </span>
    ) : (
      <span className="text-sm text-muted-foreground">Unsaved changes</span>
    );

  return (
    <header className={cn("space-y-3", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
          {breadcrumb.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span aria-hidden className="select-none">/</span>}
              {item.href != null ? (
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">{saveIndicator}</div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
