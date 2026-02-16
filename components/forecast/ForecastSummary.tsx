"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ForecastItemRow } from "./ForecastTable";

export interface ForecastSummaryProps {
  items: ForecastItemRow[];
  className?: string;
}

/** Per-stream totals in tonnes (from computed_waste_kg). Only weight-based items contribute. */
function byStreamTonnes(items: ForecastItemRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of items) {
    const streamKey = row.waste_stream_key?.trim() || "Unallocated";
    const kg = row.computed_waste_kg;
    if (kg == null || !Number.isFinite(kg) || kg < 0) continue;
    const tonnes = kg / 1000;
    map.set(streamKey, (map.get(streamKey) ?? 0) + tonnes);
  }
  return map;
}

/** Total waste in tonnes (weight-based items only). */
function totalTonnes(items: ForecastItemRow[]): number {
  let t = 0;
  for (const row of items) {
    const kg = row.computed_waste_kg;
    if (kg != null && Number.isFinite(kg) && kg >= 0) t += kg / 1000;
  }
  return t;
}

function ForecastSummaryInner({ items, className }: ForecastSummaryProps) {
  const byMaterial = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const row of items) {
      const kg = row.computed_waste_kg;
      if (kg == null || !Number.isFinite(kg) || kg < 0) continue;
      const key = row.material_type?.trim() || "Unspecified";
      map.set(key, (map.get(key) ?? 0) + kg / 1000);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const streamTonnes = React.useMemo(() => byStreamTonnes(items), [items]);
  const totalT = React.useMemo(() => totalTonnes(items), [items]);
  const streamList = Array.from(streamTonnes.entries()).sort((a, b) => b[1] - a[1]);

  const unallocatedCount = React.useMemo(
    () => items.filter((r) => !r.waste_stream_key?.trim()).length,
    [items]
  );

  return (
    <aside
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Summary</h3>
      </div>
      <div className="px-4 py-4 space-y-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Total forecast waste
          </p>
          {totalT <= 0 ? (
            <p className="text-muted-foreground text-sm">—</p>
          ) : (
            <p className="text-2xl font-semibold tabular-nums">
              {totalT.toFixed(3)}{" "}
              <span className="text-sm font-normal text-muted-foreground">tonne</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Weight-based items only</p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            By material type
          </p>
          <ul className="space-y-1.5 text-sm">
            {byMaterial.length === 0 ? (
              <li className="text-muted-foreground">—</li>
            ) : (
              byMaterial.map(([label, tonnes]) => (
                <li
                  key={label}
                  className="flex justify-between gap-2 items-baseline"
                >
                  <span className="truncate">{label}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {tonnes.toFixed(3)} t
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            By stream allocation
          </p>
          <ul className="space-y-1.5 text-sm">
            {streamList.length === 0 ? (
              <li className="text-muted-foreground">—</li>
            ) : (
              streamList.map(([streamLabel, tonnes]) => (
                <li key={streamLabel} className="flex justify-between gap-2 items-baseline">
                  <span className="truncate">{streamLabel}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0 text-right">
                    {tonnes.toFixed(3)} t
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Unallocated items
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {unallocatedCount}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              {unallocatedCount === 1 ? "item" : "items"}
            </span>
          </p>
        </div>
      </div>
    </aside>
  );
}

export const ForecastSummary = React.memo(ForecastSummaryInner);
