/**
 * Server-side forecast API helpers: allocation sync and stream totals.
 * Used by /api/projects/[id]/forecast-items and /api/forecast-items/[itemId].
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyForecastToInputs, computeForecastTotalsByStream } from "@/lib/forecastAllocation";
import { defaultSwmpInputs, normalizeSwmpInputs, SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";

export type ForecastItemForAllocation = {
  waste_stream_key: string | null;
  /** Waste in kg; null = non-weight or missing conversion (excluded from stream totals). */
  computed_waste_kg: number | null;
};

/** waste_qty_in_unit = quantity * (excess_percent / 100). Used for display in entered unit. */
export function calcWasteQty(qty: number, excessPct: number): number {
  if (!isFinite(qty) || !isFinite(excessPct)) return 0;
  return qty * (excessPct / 100);
}

/**
 * Convert waste quantity (in entered unit) to kg. Single source of truth for allocation.
 * - tonne/t: wasteKg = wasteQtyInUnit * 1000
 * - kg: wasteKg = wasteQtyInUnit
 * - m: requires kgPerM; wasteKg = wasteQtyInUnit * kgPerM
 * - m3: requires densityKgM3; wasteKg = wasteQtyInUnit * densityKgM3
 * - else: null (conversion_required, excluded from totals)
 */
export function toWasteKg(
  wasteQtyInUnit: number,
  unit: string,
  options?: { kgPerM?: number | null; densityKgM3?: number | null }
): number | null {
  if (!Number.isFinite(wasteQtyInUnit) || wasteQtyInUnit < 0) return null;
  const u = String(unit).toLowerCase().trim();
  if (u === "tonne" || u === "tonnes" || u === "t") return wasteQtyInUnit * 1000;
  if (u === "kg") return wasteQtyInUnit;
  if (u === "m" || u === "metre" || u === "metres") {
    const kgPerM = options?.kgPerM != null && Number.isFinite(options.kgPerM) && options.kgPerM >= 0 ? options.kgPerM : null;
    if (kgPerM === null) return null;
    return wasteQtyInUnit * kgPerM;
  }
  if (u === "m3" || u === "m³") {
    const d = options?.densityKgM3 != null && Number.isFinite(options.densityKgM3) && options.densityKgM3 > 0 ? options.densityKgM3 : null;
    if (d === null) return null;
    return wasteQtyInUnit * d;
  }
  return null;
}

/**
 * Compute waste in entered unit and convert to kg for allocation.
 * Uses toWasteKg internally. Null if unit not convertible (conversion_required).
 */
export function calcWasteKg(
  quantity: number,
  excessPct: number,
  unit: string,
  kgPerM?: number | null,
  densityKgM3?: number | null
): number | null {
  const wasteInUnit = calcWasteQty(quantity, excessPct);
  return toWasteKg(wasteInUnit, unit, { kgPerM, densityKgM3 });
}

/** @deprecated Use calcWasteQty. Kept for API compatibility. */
export function computeWasteQty(quantity: number, excessPercent: number): number {
  return calcWasteQty(quantity, excessPercent);
}

export type StreamTotal = { stream_key: string; total: number };

export type SyncForecastResult = {
  streamTotals: StreamTotal[];
  unallocated_count: number;
  conversion_required_count: number;
  included_count: number;
};

type ForecastRowRaw = {
  id: string;
  quantity: number;
  excess_percent: number;
  unit: string | null;
  kg_per_m: number | null;
  waste_stream_key: string | null;
};

/**
 * Recompute-by-sum: fetch all forecast items, compute waste kg from raw fields (single source of truth),
 * persist computed_waste_qty and computed_waste_kg, then apply totals to swmp_inputs. Idempotent and drift-proof.
 * Only allocated + convertible items count toward stream totals (tonnes).
 */
export async function syncForecastAllocationToInputs(
  supabase: SupabaseClient,
  projectId: string
): Promise<SyncForecastResult> {
  const { data: rows, error: itemsErr } = await supabase
    .from("project_forecast_items")
    .select("id, quantity, excess_percent, unit, kg_per_m, waste_stream_key")
    .eq("project_id", projectId);

  if (itemsErr) throw new Error(itemsErr.message);

  const items = (rows ?? []) as ForecastRowRaw[];
  let unallocated_count = 0;
  let conversion_required_count = 0;
  let included_count = 0;

  const forAllocation: ForecastItemForAllocation[] = [];
  const updates: { id: string; computed_waste_qty: number; computed_waste_kg: number | null }[] = [];

  for (const row of items) {
    const qty = Number(row.quantity) ?? 0;
    const pct = Number(row.excess_percent) ?? 0;
    const unit = (row.unit ?? "tonne").toString().trim();
    const kgPerM = row.kg_per_m != null && Number.isFinite(Number(row.kg_per_m)) ? Number(row.kg_per_m) : null;
    const wasteQty = calcWasteQty(qty, pct);
    const wasteKg = toWasteKg(wasteQty, unit, { kgPerM });

    const streamKey = row.waste_stream_key != null && String(row.waste_stream_key).trim() !== "" ? String(row.waste_stream_key).trim() : null;
    const isAllocated = streamKey != null;
    const isConvertible = wasteKg != null && Number.isFinite(wasteKg) && wasteKg >= 0;

    if (!isAllocated) unallocated_count += 1;
    else if (!isConvertible) conversion_required_count += 1;
    else included_count += 1;

    forAllocation.push({
      waste_stream_key: streamKey,
      computed_waste_kg: isConvertible ? wasteKg : null,
    });
    updates.push({
      id: row.id,
      computed_waste_qty: wasteQty,
      computed_waste_kg: wasteKg,
    });
  }

  for (const u of updates) {
    const { error: upErr } = await supabase
      .from("project_forecast_items")
      .update({
        computed_waste_qty: u.computed_waste_qty,
        computed_waste_kg: u.computed_waste_kg,
      })
      .eq("id", u.id);
    if (upErr) throw new Error(upErr.message);
  }

  const { data: inputRow, error: inputErr } = await supabase
    .from("swmp_inputs")
    .select("id, " + SWMP_INPUTS_JSON_COLUMN)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inputErr) throw new Error(inputErr.message);

  const raw = inputRow?.[SWMP_INPUTS_JSON_COLUMN as keyof typeof inputRow];
  const inputs = raw ? normalizeSwmpInputs(raw) : defaultSwmpInputs(projectId);
  const updatedInputs = applyForecastToInputs(inputs, forAllocation);

  if (inputRow?.id) {
    const { error: updateErr } = await supabase
      .from("swmp_inputs")
      .update({ [SWMP_INPUTS_JSON_COLUMN]: updatedInputs })
      .eq("id", inputRow.id);
    if (updateErr) throw new Error(updateErr.message);
  } else {
    const { error: insertErr } = await supabase
      .from("swmp_inputs")
      .insert({ project_id: projectId, [SWMP_INPUTS_JSON_COLUMN]: updatedInputs });
    if (insertErr) throw new Error(insertErr.message);
  }

  const totalsMap = computeForecastTotalsByStream(forAllocation);
  const streamTotals = Array.from(totalsMap.entries()).map(([stream_key, total]) => ({ stream_key, total }));

  return {
    streamTotals,
    unallocated_count,
    conversion_required_count,
    included_count,
  };
}
