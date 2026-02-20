"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type PhaseTabId = "inputs" | "forecast" | "carbon" | "optimiser" | "report";

export interface PhaseTabItem {
  id: PhaseTabId;
  label: string;
  href: string;
  /** Optional badge content (e.g. forecast count). */
  badge?: number | string | null;
}

export interface PhaseTabsProps {
  projectId: string;
  /** Forecast item count for badge on Forecast tab. Omit to hide badge. */
  forecastCount?: number | null;
  className?: string;
}

/**
 * Route-driven phase tabs (Inputs / Forecast / Optimiser / Report).
 * Active tab is inferred only from pathname; no local state.
 */
export function PhaseTabs({ projectId, forecastCount, className }: PhaseTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/projects/${projectId}`;

  const tabs: PhaseTabItem[] = React.useMemo(
    () => [
      { id: "inputs", label: "Inputs", href: `${base}/inputs` },
      {
        id: "forecast",
        label: "Forecast",
        href: `${base}/forecast`,
        badge: forecastCount != null ? forecastCount : undefined,
      },
      { id: "carbon", label: "Carbon Forecast", href: `${base}/carbon` },
      { id: "optimiser", label: "Optimiser", href: `${base}/optimiser` },
      { id: "report", label: "Report", href: `${base}/swmp` },
    ],
    [base, forecastCount]
  );

  const isActive = (href: string) => {
    if (href === `${base}/inputs`) return pathname === `${base}/inputs` || pathname === base;
    if (href === `${base}/swmp`) return pathname === `${base}/swmp` || pathname === `${base}/report`;
    if (href === `${base}/carbon`) return pathname === `${base}/carbon`;
    return pathname === href;
  };

  return (
    <nav
      className={cn(
        "inline-flex h-9 items-center justify-center gap-0 rounded-lg bg-muted p-[3px] text-muted-foreground",
        className
      )}
      aria-label="Project phases"
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => router.push(tab.href)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-transparent bg-background text-foreground shadow-sm"
                : "border-transparent bg-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.badge != null && (
              <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-xs tabular-nums bg-muted">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
