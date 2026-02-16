/**
 * Allocation engine: map forecast items to Inputs waste streams via waste_stream_key (stream name/category).
 * - Each forecast item allocates to exactly one stream (waste_stream_key). Streams live in swmp_inputs.inputs JSON (waste_streams + waste_stream_plans).
 * - forecast_qty per stream = SUM(computed_waste_qty) of items allocated to that stream. Recompute-by-sum on every sync (no incremental add/subtract) to avoid double counting.
 * - Never overwrite estimated_qty (manual entry); only set forecast_qty. total_qty = manual_qty + forecast_qty is computed in the UI.
 */

import type { SwmpInputs, WasteStreamPlanInput } from "@/lib/swmp/model";
import {
  getDefaultIntendedOutcomesForStream,
  getDefaultUnitForStream,
} from "@/lib/swmp/model";
const MIXED_CD_KEY = "Mixed C&D";

/** Map material_type (from MATERIAL_TYPE_OPTIONS) to preferred waste stream key(s). First match in project wins. */
export const MATERIAL_TYPE_TO_STREAM_KEYS: Record<string, string[]> = {
  "Mixed C&D": [MIXED_CD_KEY],
  Timber: ["Timber (untreated)", "Timber (treated)"],
  "Concrete / masonry": ["Concrete / masonry", "Concrete (reinforced)", "Concrete (unreinforced)", "Masonry / bricks"],
  Metals: ["Metals"],
  "Plasterboard / GIB": ["Plasterboard / GIB"],
  Cardboard: ["Cardboard"],
  Plastics: ["Soft plastics (wrap/strapping)", "Hard plastics", "Packaging (mixed)", "PVC pipes / services", "HDPE pipes / services"],
  Glass: ["Glass"],
  "Green waste": ["Green waste / vegetation"],
  "Soil / spoil": ["Soil / spoil (cleanfill if verified)", "Cleanfill soil", "Contaminated soil"],
  Hazardous: ["Hazardous waste (general)", "Paints/adhesives/chemicals"],
  Other: [MIXED_CD_KEY],
};

/** Single suggested stream key for a material type (first option). Used for "Add as stream". Accepts catalog name (may equal stream key). */
export function getSuggestedStreamKeyForMaterial(materialType: string | null): string | null {
  if (!materialType?.trim()) return null;
  const key = materialType.trim();
  const keys = MATERIAL_TYPE_TO_STREAM_KEYS[key];
  if (keys?.length) return keys[0] ?? null;
  return key;
}

/** Find a project stream that matches this material type. Returns first match from MATERIAL_TYPE_TO_STREAM_KEYS that exists in projectStreams, or the material type itself if it exists in projectStreams (catalog name = stream key). */
export function getMatchingProjectStream(
  materialType: string | null,
  projectStreams: string[]
): string | null {
  if (!materialType?.trim() || !projectStreams?.length) return null;
  const key = materialType.trim();
  const set = new Set(projectStreams.map((s) => s.trim()));
  if (set.has(key)) return key;
  const keys = MATERIAL_TYPE_TO_STREAM_KEYS[key];
  if (!keys?.length) return null;
  for (const k of keys) {
    if (set.has(k)) return k;
  }
  return null;
}

export type ForecastItemForAllocation = {
  waste_stream_key: string | null;
  /** Waste in kg; null/undefined = non-weight (excluded from totals). */
  computed_waste_kg?: number | null;
};

/** Compute total forecast tonnes per stream from items (computed_waste_kg / 1000). Only weight-based items contribute. */
export function computeForecastTotalsByStream(
  items: ForecastItemForAllocation[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item.waste_stream_key?.trim();
    if (!key) continue;
    const kg = item.computed_waste_kg;
    if (kg == null || !Number.isFinite(kg) || kg < 0) continue;
    const tonnes = kg / 1000;
    map.set(key, (map.get(key) ?? 0) + tonnes);
  }
  return map;
}

/** Apply forecast totals to inputs: set each plan's forecast_qty (tonnes) from SUM(computed_waste_kg)/1000 of items with matching waste_stream_key. Streams with no items get 0. Never touch manual/estimated_qty. Idempotent. */
export function applyForecastToInputs(
  inputs: SwmpInputs,
  items: ForecastItemForAllocation[]
): SwmpInputs {
  const totalsByStream = computeForecastTotalsByStream(items);
  if (process.env.NODE_ENV === "development" && items.length > 0) {
    console.debug(
      "[forecastAllocation] applyForecastToInputs totals",
      Object.fromEntries(totalsByStream)
    );
  }
  const plans: WasteStreamPlanInput[] = (inputs.waste_stream_plans ?? []).map((plan) => {
    const total = totalsByStream.get(plan.category) ?? 0;
    return { ...plan, forecast_qty: total === 0 ? null : total, forecast_unit: plan.forecast_unit ?? "tonne" };
  });
  return { ...inputs, waste_stream_plans: plans };
}

/** Build a new plan entry for a stream category (for adding to inputs). */
function buildNewPlanForCategory(category: string): WasteStreamPlanInput {
  const unit = getDefaultUnitForStream(category);
  return {
    category,
    sub_material: null,
    intended_outcomes: getDefaultIntendedOutcomesForStream(category),
    partner_id: null,
    facility_id: null,
    destination_override: null,
    partner: null,
    partner_overridden: false,
    pathway: `Segregate ${category} where practical and send to an approved recycler/processor.`,
    notes: null,
    estimated_qty: null,
    manual_qty_tonnes: null,
    unit,
    density_kg_m3: null,
    thickness_m: null,
    generated_by: null,
    on_site_management: null,
    destination: null,
    distance_km: null,
    waste_contractor_partner_id: null,
    forecast_qty: null,
    forecast_unit: "tonne",
    handling_mode: "mixed",
  };
}

/** Ensure a waste stream exists in inputs. If missing, adds to waste_streams and waste_stream_plans. Returns new inputs. */
export function ensureStreamInInputs(
  inputs: SwmpInputs,
  streamKey: string
): SwmpInputs {
  const key = streamKey.trim();
  if (!key) return inputs;
  const streams = inputs.waste_streams ?? [];
  if (streams.includes(key)) return inputs;
  const plans = inputs.waste_stream_plans ?? [];
  const hasPlan = plans.some((p) => p.category === key);
  if (hasPlan) return inputs;

  const newStreams = [...streams, key];
  const newPlan = buildNewPlanForCategory(key);
  const newPlans = [...plans, newPlan];
  if (process.env.NODE_ENV === "development") {
    console.debug("[forecastAllocation] ensureStreamInInputs: added stream", key);
  }
  return { ...inputs, waste_streams: newStreams, waste_stream_plans: newPlans };
}

/** Ensure Mixed C&D exists (for "Add to Mixed C&D" action). */
export function ensureMixedCDInInputs(inputs: SwmpInputs): SwmpInputs {
  return ensureStreamInInputs(inputs, MIXED_CD_KEY);
}
