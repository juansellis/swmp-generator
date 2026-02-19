/**
 * Server-side forecast API helpers: allocation sync and stream totals.
 * Used by /api/projects/[id]/forecast-items and /api/forecast-items/[itemId].
 * Conversion priority: item override -> stream defaults -> conversion_factors -> else conversion_required (tonnes for reporting).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversionOptionsByStream = Map<
  string,
  { densityKgM3: number | null; kgPerM: number | null }
>;

const CONVERSION_FACTORS_TABLE_MISSING =
  "Could not find the table 'public.conversion_factors' in the schema cache";

/**
 * Load per-stream conversion options (density for m3->kg, kg_per_m for m->kg).
 * Priority: waste_streams.default_* then active conversion_factors by waste_stream_id.
 * Key = stream name (waste_stream_key in forecast items).
 * If conversion_factors table is missing, returns options from waste_streams defaults only (no throw).
 */
export async function getConversionOptions(
  supabase: SupabaseClient
): Promise<ConversionOptionsByStream> {
  const { data: streams, error: streamsErr } = await supabase
    .from("waste_streams")
    .select("id, name, default_density_kg_m3, default_kg_per_m")
    .eq("is_active", true);

  if (streamsErr) throw new Error(streamsErr.message);
  const streamList = (streams ?? []) as Array<{
    id: string;
    name: string;
    default_density_kg_m3: number | null;
    default_kg_per_m: number | null;
  }>;

  const streamIds = streamList.length > 0 ? streamList.map((s) => s.id) : [];
  let factorList: Array<{ waste_stream_id: string; from_unit: string; to_unit: string; factor: number }> = [];

  if (streamIds.length > 0) {
    const { data: factors, error: factorsErr } = await supabase
      .from("conversion_factors")
      .select("waste_stream_id, from_unit, to_unit, factor")
      .in("waste_stream_id", streamIds)
      .eq("is_active", true);

    if (factorsErr) {
      if (factorsErr.message.includes(CONVERSION_FACTORS_TABLE_MISSING)) {
        factorList = [];
      } else {
        throw new Error(factorsErr.message);
      }
    } else {
      factorList = (factors ?? []) as Array<{
        waste_stream_id: string;
        from_unit: string;
        to_unit: string;
        factor: number;
      }>;
    }
  }

  const factorByStreamUnit = new Map<string, number>();
  for (const f of factorList) {
    if (f.to_unit !== "kg") continue;
    const k = `${f.waste_stream_id}:${f.from_unit}`;
    const n = Number(f.factor);
    if (Number.isFinite(n) && n >= 0) factorByStreamUnit.set(k, n);
  }

  const map: ConversionOptionsByStream = new Map();
  for (const s of streamList) {
    const name = (s.name ?? "").trim();
    if (!name) continue;
    const density =
      s.default_density_kg_m3 != null && Number.isFinite(Number(s.default_density_kg_m3))
        ? Number(s.default_density_kg_m3)
        : factorByStreamUnit.get(`${s.id}:m3`) ?? null;
    const kgPerM =
      s.default_kg_per_m != null && Number.isFinite(Number(s.default_kg_per_m))
        ? Number(s.default_kg_per_m)
        : factorByStreamUnit.get(`${s.id}:m`) ?? null;
    map.set(name, { densityKgM3: density, kgPerM });
  }
  return map;
}

/**
 * Returns the set of waste stream names that have at least one active conversion factor.
 * Used to detect when report calculations used fallback (stream default) instead of configured factors.
 */
export async function getStreamsWithConfiguredFactors(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data: factors, error: factorsErr } = await supabase
    .from("conversion_factors")
    .select("waste_stream_id")
    .eq("is_active", true);

  if (factorsErr?.message?.includes(CONVERSION_FACTORS_TABLE_MISSING) || !factors?.length) {
    return new Set();
  }

  const ids = [...new Set((factors as { waste_stream_id: string }[]).map((r) => r.waste_stream_id))];
  if (ids.length === 0) return new Set();

  const { data: streams, error: streamsErr } = await supabase
    .from("waste_streams")
    .select("id, name")
    .in("id", ids)
    .eq("is_active", true);

  if (streamsErr || !streams?.length) return new Set();

  const names = new Set<string>();
  for (const s of streams as { id: string; name: string }[]) {
    const name = (s.name ?? "").trim();
    if (name) names.add(name);
  }
  return names;
}

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
  density_kg_m3: number | null;
  allocated_stream_id: string | null;
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
  const [conversionMap, streamIdToName, itemsResult] = await Promise.all([
    getConversionOptions(supabase),
    supabase.from("waste_streams").select("id, name").eq("is_active", true),
    supabase
      .from("project_forecast_items")
      .select("id, quantity, excess_percent, unit, kg_per_m, density_kg_m3, allocated_stream_id, waste_stream_key")
      .eq("project_id", projectId),
  ]);

  const { data: rows, error: itemsErr } = itemsResult;
  if (itemsErr) throw new Error(itemsErr.message);

  const idToName = new Map(
    ((streamIdToName.data ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, (s.name ?? "").trim()])
  );

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
    const streamKey =
      row.allocated_stream_id && idToName.has(row.allocated_stream_id)
        ? idToName.get(row.allocated_stream_id)!
        : (row.waste_stream_key != null && String(row.waste_stream_key).trim() !== "" ? String(row.waste_stream_key).trim() : null);
    const streamOpts = streamKey ? conversionMap.get(streamKey) : undefined;
    const kgPerM = row.kg_per_m != null && Number.isFinite(Number(row.kg_per_m)) ? Number(row.kg_per_m) : (streamOpts?.kgPerM ?? null);
    const rowDensity = row.density_kg_m3 != null && Number.isFinite(Number(row.density_kg_m3)) && Number(row.density_kg_m3) > 0 ? Number(row.density_kg_m3) : null;
    const densityKgM3 = rowDensity ?? (streamOpts?.densityKgM3 ?? null);
    const wasteQty = calcWasteQty(qty, pct);
    const wasteKg = toWasteKg(wasteQty, unit, { kgPerM, densityKgM3 });

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

  const inputRowData = (inputRow ?? null) as unknown as { id?: string; [k: string]: unknown } | null;
  const raw = inputRowData?.[SWMP_INPUTS_JSON_COLUMN];
  const inputs = raw ? normalizeSwmpInputs(raw) : defaultSwmpInputs(projectId);
  const updatedInputs = applyForecastToInputs(inputs, forAllocation);

  const inputRowId = inputRowData?.id;
  if (inputRowId) {
    const { error: updateErr } = await supabase
      .from("swmp_inputs")
      .update({ [SWMP_INPUTS_JSON_COLUMN]: updatedInputs })
      .eq("id", inputRowId);
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
