/**
 * Project Planning Checklist — deterministic, server-side.
 * Computes readiness for submit-ready SWMP from existing tables (no heavy joins).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { calcWasteQty, toWasteKg } from "@/lib/forecastApi";
import { normalizeSwmpInputs, SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";
import { buildWasteStrategy } from "./wasteStrategyBuilder";
import type { StreamPlanItem } from "./wasteStrategyBuilder";

const MIXED_CD_KEY = "Mixed C&D";

export type ChecklistItemStatus = "complete" | "incomplete" | "blocked";

export type ChecklistCta = {
  label: string;
  href?: string;
  action?: string;
};

export type PlanningChecklistItem = {
  key: string;
  label: string;
  status: ChecklistItemStatus;
  detail?: string;
  count?: number;
  cta?: ChecklistCta;
};

export type PlanningChecklist = {
  readiness_score: number;
  items: PlanningChecklistItem[];
  next_best_action?: ChecklistCta;
};

type ForecastCounts = {
  unallocated_count: number;
  conversion_required_count: number;
  total_count: number;
};

async function getForecastCounts(
  supabase: SupabaseClient,
  projectId: string
): Promise<ForecastCounts> {
  const { data: rows, error } = await supabase
    .from("project_forecast_items")
    .select("quantity, excess_percent, unit, kg_per_m, waste_stream_key")
    .eq("project_id", projectId);

  if (error) return { unallocated_count: 0, conversion_required_count: 0, total_count: 0 };
  const raw = (rows ?? []) as {
    quantity: number;
    excess_percent: number;
    unit: string | null;
    kg_per_m: number | null;
    waste_stream_key: string | null;
  }[];
  let unallocated = 0;
  let conversionRequired = 0;
  for (const row of raw) {
    const streamKey =
      row.waste_stream_key != null && String(row.waste_stream_key).trim() !== ""
        ? String(row.waste_stream_key).trim()
        : null;
    const wasteQty = calcWasteQty(Number(row.quantity) ?? 0, Number(row.excess_percent) ?? 0);
    const wasteKg = toWasteKg(wasteQty, (row.unit ?? "tonne").toString(), {
      kgPerM: row.kg_per_m != null && Number.isFinite(Number(row.kg_per_m)) ? Number(row.kg_per_m) : null,
    });
    if (!streamKey) unallocated += 1;
    else if (wasteKg == null || !Number.isFinite(wasteKg)) conversionRequired += 1;
  }
  return {
    unallocated_count: unallocated,
    conversion_required_count: conversionRequired,
    total_count: raw.length,
  };
}

function href(projectId: string, path: string, search?: string): string {
  const base = `/projects/${projectId}${path}`;
  return search ? `${base}${search}` : base;
}

/**
 * Compute the full planning checklist for a project.
 * Uses: project_forecast_items, swmp_inputs, and buildWasteStrategy (which reads inputs + forecast again).
 */
export async function getPlanningChecklist(
  projectId: string,
  supabase: SupabaseClient
): Promise<PlanningChecklist> {
  const [countsResult, inputsResult, strategyResult] = await Promise.all([
    getForecastCounts(supabase, projectId),
    supabase
      .from("swmp_inputs")
      .select(SWMP_INPUTS_JSON_COLUMN)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    buildWasteStrategy(projectId, supabase).catch(() => null),
  ]);

  const counts = countsResult;
  const rawInputs = (inputsResult.data as { inputs?: unknown } | null)?.inputs ?? null;
  const inputs = rawInputs ? normalizeSwmpInputs(rawInputs) : null;
  const strategy = strategyResult;

  const streams = inputs?.waste_streams ?? [];
  const plans = inputs?.waste_stream_plans ?? [];
  const hasMixedCD =
    streams.some((s) => (s ?? "").trim() === MIXED_CD_KEY) ||
    plans.some((p) => (p.category ?? "").trim() === MIXED_CD_KEY);
  const streamsConfigured = streams.length >= 1 && hasMixedCD;

  const streamPlans: StreamPlanItem[] = strategy?.streamPlans ?? [];
  const withTonnes = streamPlans.filter((s) => s.total_tonnes > 0);
  const allHandlingSet =
    withTonnes.length === 0 ||
    withTonnes.every((s) => s.handling_mode != null);
  const allOutcomesSet =
    withTonnes.length === 0 ||
    withTonnes.every((s) => s.intended_outcome != null && s.intended_outcome !== "unknown");
  const allFacilitiesSet =
    withTonnes.length === 0 ||
    withTonnes.every((s) => s.assigned_facility_id != null && s.assigned_facility_id !== "");
  const strategyGenerated = strategy != null && Array.isArray(strategy.streamPlans) && strategy.streamPlans.length > 0;

  const allocatedCount = counts.total_count - counts.unallocated_count;
  const allocationBlocked = counts.total_count > 0 && allocatedCount === 0;

  const items: PlanningChecklistItem[] = [];

  // 1) Forecast items allocated
  const allocStatus: ChecklistItemStatus = counts.unallocated_count === 0 ? "complete" : allocationBlocked ? "blocked" : "incomplete";
  items.push({
    key: "forecast_allocated",
    label: "Forecast items allocated",
    status: allocStatus,
    detail:
      counts.unallocated_count === 0
        ? "All items assigned to a stream"
        : allocationBlocked
          ? "No items allocated to any stream"
          : `${counts.unallocated_count} item(s) unallocated`,
    count: counts.unallocated_count === 0 ? undefined : counts.unallocated_count,
    cta:
      allocStatus !== "complete"
        ? { label: "Allocate in Forecast", href: href(projectId, "/forecast", "?filter=unallocated") }
        : undefined,
  });

  // 2) Unit conversions resolved
  const convComplete = counts.conversion_required_count === 0;
  items.push({
    key: "conversions_resolved",
    label: "Unit conversions resolved",
    status: convComplete ? "complete" : "incomplete",
    detail: convComplete ? "All items have valid weight conversion" : `${counts.conversion_required_count} need conversion`,
    count: convComplete ? undefined : counts.conversion_required_count,
    cta: !convComplete
      ? { label: "Fix in Forecast", href: href(projectId, "/forecast", "?filter=needs_conversion") }
      : undefined,
  });

  // 3) Waste streams configured
  items.push({
    key: "streams_configured",
    label: "Waste streams configured",
    status: streamsConfigured ? "complete" : "incomplete",
    detail: streamsConfigured ? "Streams set up including Mixed C&D" : "Add at least one stream and ensure Mixed C&D exists",
    cta: !streamsConfigured ? { label: "Configure streams", href: href(projectId, "/inputs") } : undefined,
  });

  // 4) Handling mode set
  items.push({
    key: "handling_mode_set",
    label: "Handling mode set (mixed/separated)",
    status: allHandlingSet ? "complete" : "incomplete",
    detail: allHandlingSet ? "All active streams have handling set" : "Set handling for streams with tonnes",
    cta: !allHandlingSet ? { label: "Set in Inputs", href: href(projectId, "/inputs") } : undefined,
  });

  // 5) Intended outcomes set
  items.push({
    key: "outcomes_set",
    label: "Intended outcomes set",
    status: allOutcomesSet ? "complete" : "incomplete",
    detail: allOutcomesSet ? "All active streams have outcomes" : "Set intended outcome per stream",
    cta: !allOutcomesSet ? { label: "Set in Inputs", href: href(projectId, "/inputs") } : undefined,
  });

  // 6) Facilities selected
  items.push({
    key: "facilities_selected",
    label: "Facilities selected for streams",
    status: allFacilitiesSet ? "complete" : "incomplete",
    detail: allFacilitiesSet ? "All active streams have a facility" : "Choose facility per stream",
    cta: !allFacilitiesSet
      ? { label: "Select in Inputs or Strategy", href: href(projectId, "/swmp", "?section=strategy") }
      : undefined,
  });

  // 7) Strategy generated
  items.push({
    key: "strategy_generated",
    label: "Strategy generated",
    status: strategyGenerated ? "complete" : "incomplete",
    detail: strategyGenerated ? "Waste strategy computed" : "View Outputs to generate strategy",
    cta: !strategyGenerated ? { label: "Open Strategy", href: href(projectId, "/swmp", "?section=strategy") } : undefined,
  });

  // 8) Export ready
  const allComplete = items.every((i) => i.status === "complete");
  items.push({
    key: "export_ready",
    label: "Export ready",
    status: allComplete ? "complete" : "incomplete",
    detail: allComplete ? "Ready to export SWMP" : "Complete the items above first",
    cta: allComplete ? { label: "Export SWMP", href: href(projectId, "/swmp", "?export=1"), action: "export" } : undefined,
  });

  // Readiness score: weighted. allocation + conversions + facilities slightly higher (e.g. 15% each), rest ~10% each = 15+15+10+10+10+15+10+15 = 100
  const weights: Record<string, number> = {
    forecast_allocated: 15,
    conversions_resolved: 15,
    streams_configured: 10,
    handling_mode_set: 10,
    outcomes_set: 10,
    facilities_selected: 15,
    strategy_generated: 10,
    export_ready: 15,
  };
  let score = 0;
  for (const item of items) {
    if (item.status === "complete") score += weights[item.key] ?? 0;
  }
  const readiness_score = Math.round(Math.min(100, Math.max(0, score)));

  // Next best action: first incomplete or blocked with CTA
  const nextItem = items.find((i) => i.status !== "complete" && i.cta);
  const next_best_action = nextItem?.cta;

  return {
    readiness_score,
    items,
    next_best_action,
  };
}
