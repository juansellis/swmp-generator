/**
 * Waste Strategy Builder Engine (planning intelligence).
 * Deterministic, export-ready. No LLM required.
 * Given project inputs + forecast, produces recommended separation strategy,
 * facility utilisation, diversion plan, actionable recommendations, and SWMP narrative.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSwmpInputs, SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";
import type { WasteStreamPlanInput } from "@/lib/swmp/model";
import { getDefaultUnitForStreamLabel, planManualQtyToTonnes } from "@/lib/wasteStreamDefaults";
import {
  getFacilitiesForStream,
  getFacilityById,
  type Facility,
} from "@/lib/facilities/getFacilities";
import { getPartnerById } from "@/lib/partners/getPartners";
import { calcWasteQty, getConversionOptions, getStreamsWithConfiguredFactors, toWasteKg } from "@/lib/forecastApi";
import {
  getCostSavingPerTonnesDivertedFromLandfill,
  getCostSavingPerTonnesDivertedFromMixed,
  getCarbonSavingPerTonnesDivertedTco2e,
  NOTE_APPROXIMATE_RANGES,
} from "./wasteStrategyConstants";
import {
  buildDistanceMapFromRows,
  getDistanceForFacility,
  type DistanceEntry,
  type DistanceRow,
} from "@/lib/distance/getProjectFacilityDistanceMap";

const MIXED_CD_KEY = "Mixed C&D";

/** Number of recommendations to show by default in UI; "View all" shows rest. */
export const RECOMMENDATION_DISPLAY_LIMIT = 6;

// ---------------------------------------------------------------------------
// Data contract: WasteStrategyResult
// ---------------------------------------------------------------------------

export type RecommendedHandling = "separate" | "mixed" | "reduce_at_source";

export type IntendedOutcomeLabel = "recycle" | "reuse" | "landfill" | "unknown";

/** User-selected handling from inputs: mixed (co-mingled) or separated (source-separated onsite). */
export type HandlingMode = "mixed" | "separated";

export type StreamPlanItem = {
  stream_id: string;
  stream_name: string;
  total_tonnes: number;
  manual_tonnes: number;
  forecast_tonnes: number;
  /** User's planned handling from inputs. */
  handling_mode: HandlingMode;
  recommended_handling: RecommendedHandling;
  /** User-assigned facility from inputs (plan.facility_id). Null if not set. */
  assigned_facility_id: string | null;
  /** Destination type from inputs; used for strict destination display in Report. */
  destination_mode: "facility" | "custom" | null;
  /** Custom destination display (name or address) when destination_mode === 'custom'. */
  custom_destination_name: string | null;
  custom_destination_address: string | null;
  /** Canonical effective distance (km) for this plan: from persisted plan.distance_km or project_facility_distances / project_custom_destination_distances. Used everywhere (cards, table, overview). */
  distance_km: number | null;
  /** Cached duration (min) when distance was computed. */
  duration_min: number | null;
  /** Effective partner for this stream (stream.partner_id ?? project.primary_waste_contractor_partner_id). Used for partner-based facility recommendation. */
  partner_id: string | null;
  recommended_facility_id: string | null;
  recommended_facility_name: string | null;
  recommended_partner_id: string | null;
  recommended_partner_name: string | null;
  intended_outcome: IntendedOutcomeLabel;
  /** Single disposal method string for display (e.g. "Recover", "Cleanfill"). */
  intended_outcome_display: string;
  rationale: string[];
  actions: { type: string; label: string; impact_hint: string }[];
};

export type RecommendationPriority = "high" | "medium" | "low";

export type RecommendationConfidence = "high" | "medium" | "low";

export type RecommendationCategory =
  | "source_separation"
  | "facility_optimisation"
  | "procurement_reduction"
  | "site_logistics"
  | "contractor_engagement"
  | "documentation"
  | "data_quality";

export type ApplyActionType =
  | "create_stream"
  | "allocate_to_mixed"
  | "set_facility"
  | "set_outcome"
  | "mark_stream_separate";

export type StrategyRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  confidence: RecommendationConfidence;
  category: RecommendationCategory;
  triggers: string[];
  estimated_impact: {
    tonnes_diverted?: number;
    diversion_delta_percent?: number;
    cost_savings_nzd_range?: [number, number];
    carbon_savings_tco2e_range?: [number, number];
    notes?: string[];
  };
  implementation_steps: string[];
  apply_action?: {
    type: ApplyActionType;
    payload: unknown;
  };
};

/** @deprecated Use ApplyActionType / category. Kept for compatibility. */
export type RecommendationActionType =
  | "add_stream"
  | "separate_stream"
  | "change_facility"
  | "reduce_overordering"
  | "allocate_forecast"
  | "fix_conversions";

export type WasteStrategySummary = {
  total_estimated_tonnes: number;
  estimated_diversion_percent: number;
  estimated_landfill_percent: number;
  streams_count: number;
  facilities_utilised_count: number;
};

export type WasteStrategyNarrative = {
  swmp_summary_paragraph: string;
  methodology_paragraph: string;
  key_assumptions: string[];
  facility_plan_paragraph: string;
  /** Bullet list of top recommendations for narrative/export. */
  top_recommendations_bullets: string[];
  /** Major drivers of diversion (e.g. key streams, facility choices). */
  major_drivers_paragraph: string;
};

export type ConversionsUsed = {
  usedFallback: boolean;
  fallbackCount: number;
  missingKeys: string[];
};

export type WasteStrategyResult = {
  summary: WasteStrategySummary;
  streamPlans: StreamPlanItem[];
  recommendations: StrategyRecommendation[];
  narrative: WasteStrategyNarrative;
  /** Only show conversion warning when usedFallback or fallbackCount > 0. */
  conversionsUsed: ConversionsUsed;
};

// Extended facility type for optional diversion_rate (future DB)
type FacilityWithRate = Facility & { diversion_rate?: number | null };

/** Generate a stable id for a recommendation (slug from category + title). */
let recIdCounter = 0;
function nextRecId(category: RecommendationCategory, title: string): string {
  const slug = `${category}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  recIdCounter += 1;
  return `${slug}-${recIdCounter}`;
}

function toNotes(notes: string | string[] | undefined): string[] | undefined {
  if (notes == null) return undefined;
  if (Array.isArray(notes)) return notes.length ? notes : undefined;
  return [notes];
}

// ---------------------------------------------------------------------------
// Helpers: significance, outcome label, recyclable
// ---------------------------------------------------------------------------

function classifySignificance(totalTonnes: number): "major" | "medium" | "minor" {
  if (totalTonnes >= 1.0) return "major";
  if (totalTonnes >= 0.2) return "medium";
  return "minor";
}

function getIntendedOutcomeLabel(outcomes: string[]): IntendedOutcomeLabel {
  const single = outcomes?.length ? String(outcomes[0]).trim() : "";
  if (!single) return "unknown";
  if (single === "Landfill") return "landfill";
  if (single === "Reuse") return "reuse";
  if (
    single === "Recycle" ||
    single === "Recover" ||
    single === "Cleanfill" ||
    single === "Reduce"
  )
    return "recycle";
  return "unknown";
}

function isRecyclableOrReusable(outcomes: string[]): boolean {
  const label = getIntendedOutcomeLabel(outcomes);
  return label === "recycle" || label === "reuse";
}

function isHazardousOrSpecial(streamName: string): boolean {
  const lower = streamName.toLowerCase();
  return (
    lower.includes("hazardous") ||
    lower.includes("contaminated") ||
    lower.includes("paint") ||
    lower.includes("chemical") ||
    lower.includes("asbestos")
  );
}

// ---------------------------------------------------------------------------
// Recommend handling for a stream
// ---------------------------------------------------------------------------

function recommendHandling(
  streamName: string,
  totalTonnes: number,
  outcomes: string[]
): RecommendedHandling {
  if (streamName === MIXED_CD_KEY) return "mixed";
  const sig = classifySignificance(totalTonnes);
  const recyclable = isRecyclableOrReusable(outcomes);
  if (sig === "minor" && !isHazardousOrSpecial(streamName)) return "mixed";
  if ((sig === "major" || sig === "medium") && recyclable) return "separate";
  if (sig === "minor" && isHazardousOrSpecial(streamName)) return "separate";
  return "mixed";
}

// ---------------------------------------------------------------------------
// Best facility for stream: existing if valid, else by accepted_streams then diversion_rate
// ---------------------------------------------------------------------------

/**
 * Optional map from project_facility_distances (normalized by facility id). When provided, facility selection
 * sorts by diversion_rate first, then by shorter distance.
 */
function pickBestFacility(
  streamName: string,
  region: string | null,
  existingFacilityId: string | null,
  partnerId: string | null,
  distanceMap?: Record<string, DistanceEntry> | null
): { facility: FacilityWithRate | null; partnerId: string | null; partnerName: string | null } {
  const existing = existingFacilityId ? getFacilityById(existingFacilityId) : null;
  const existingWithRate = existing as FacilityWithRate | null;
  if (
    existingWithRate &&
    existingWithRate.accepted_streams?.includes(streamName)
  ) {
    const partner = getPartnerById(existingWithRate.partner_id);
    return {
      facility: existingWithRate,
      partnerId: existingWithRate.partner_id,
      partnerName: partner?.name ?? null,
    };
  }

  let candidates = getFacilitiesForStream(
    partnerId ?? undefined,
    region ?? "",
    streamName
  ) as FacilityWithRate[];
  if (!candidates.length && region) {
    candidates = getFacilitiesForStream(undefined, region, streamName) as FacilityWithRate[];
  }
  if (!candidates.length) {
    return { facility: null, partnerId: null, partnerName: null };
  }

  const sorted = [...candidates].sort((a, b) => {
    const rateA = a.diversion_rate ?? 0;
    const rateB = b.diversion_rate ?? 0;
    if (rateB !== rateA) return rateB - rateA;
    const distA = distanceMap ? (getDistanceForFacility(distanceMap, a.id)?.distance_km ?? Infinity) : Infinity;
    const distB = distanceMap ? (getDistanceForFacility(distanceMap, b.id)?.distance_km ?? Infinity) : Infinity;
    return distA - distB;
  });
  const best = sorted[0];
  const partner = getPartnerById(best.partner_id);
  return {
    facility: best,
    partnerId: best.partner_id,
    partnerName: partner?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Build stream plan item with rationale and actions
// ---------------------------------------------------------------------------

function buildStreamPlan(
  plan: WasteStreamPlanInput,
  manualTonnes: number,
  forecastTonnes: number,
  region: string | null,
  projectPartnerId: string | null,
  distanceMap?: Record<string, DistanceEntry> | null
): StreamPlanItem {
  const streamName = (plan.category ?? "").trim() || MIXED_CD_KEY;
  const totalTonnes = manualTonnes + forecastTonnes;
  const outcomes = plan.intended_outcomes ?? [];
  const intendedOutcome = getIntendedOutcomeLabel(outcomes);
  const recommendedHandling = recommendHandling(streamName, totalTonnes, outcomes);

  const { facility, partnerId, partnerName } = pickBestFacility(
    streamName,
    region,
    plan.facility_id ?? null,
    plan.partner_id ?? plan.waste_contractor_partner_id ?? projectPartnerId,
    distanceMap
  );

  const rationale: string[] = [];
  const actions: { type: string; label: string; impact_hint: string }[] = [];

  const sig = classifySignificance(totalTonnes);
  if (sig === "major") rationale.push("Major stream (≥1 t); prioritise separation.");
  else if (sig === "medium") rationale.push("Medium stream (0.2–1 t); separate if recyclable.");
  else rationale.push("Minor stream (<0.2 t); mixed acceptable unless hazardous.");

  if (recommendedHandling === "separate" && isRecyclableOrReusable(outcomes))
    rationale.push("Recyclable/reusable; recommend separate collection.");
  if (recommendedHandling === "mixed" && streamName !== MIXED_CD_KEY)
    rationale.push("Keep in mixed stream to reduce complexity.");
  if (streamName === MIXED_CD_KEY) rationale.push("Mixed C&D is the catch-all stream.");

  if (!facility && totalTonnes > 0) {
    actions.push({
      type: "select_facility",
      label: `Choose facility for ${streamName}`,
      impact_hint: "Enables tracking and diversion reporting.",
    });
  }
  if (
    recommendedHandling === "separate" &&
    (sig === "major" || sig === "medium") &&
    streamName !== MIXED_CD_KEY
  ) {
    actions.push({
      type: "separate_stream",
      label: `Separate ${streamName} onsite`,
      impact_hint: "Increases diversion and reduces mixed reliance.",
    });
  }

  const handlingMode: HandlingMode =
    plan.handling_mode === "separated" || plan.handling_mode === "mixed"
      ? plan.handling_mode
      : "mixed";
  const assignedFacilityId = plan.facility_id != null && String(plan.facility_id).trim() !== "" ? String(plan.facility_id).trim() : null;
  const destinationMode: "facility" | "custom" | null =
    plan.destination_mode === "custom" || plan.destination_mode === "facility" ? plan.destination_mode : "facility";
  const customName =
    plan.custom_destination_name != null && String(plan.custom_destination_name).trim() !== ""
      ? String(plan.custom_destination_name).trim()
      : null;
  const customAddress =
    plan.custom_destination_address != null && String(plan.custom_destination_address).trim() !== ""
      ? String(plan.custom_destination_address).trim()
      : null;
  const effectivePartnerId =
    plan.partner_id != null && String(plan.partner_id).trim() !== ""
      ? String(plan.partner_id).trim()
      : plan.waste_contractor_partner_id != null && String(plan.waste_contractor_partner_id).trim() !== ""
        ? String(plan.waste_contractor_partner_id).trim()
        : projectPartnerId;

  const planDistanceKm =
    plan.distance_km != null && Number.isFinite(plan.distance_km) && plan.distance_km >= 0
      ? plan.distance_km
      : null;
  const planDurationMin =
    plan.duration_min != null && Number.isFinite(plan.duration_min) && plan.duration_min >= 0
      ? plan.duration_min
      : null;
  const cacheEntry = assignedFacilityId ? getDistanceForFacility(distanceMap ?? {}, assignedFacilityId) : null;
  const distance_km =
    planDistanceKm ??
    (cacheEntry?.distance_km != null && Number.isFinite(cacheEntry.distance_km) ? cacheEntry.distance_km : null);
  const duration_min = planDurationMin ?? (cacheEntry?.duration_min ?? null);

  return {
    stream_id: streamName.replace(/\s+/g, "-").toLowerCase(),
    stream_name: streamName,
    total_tonnes: totalTonnes,
    manual_tonnes: manualTonnes,
    forecast_tonnes: forecastTonnes,
    handling_mode: handlingMode,
    recommended_handling: recommendedHandling,
    assigned_facility_id: assignedFacilityId,
    destination_mode: destinationMode,
    custom_destination_name: customName,
    custom_destination_address: customAddress,
    distance_km,
    duration_min,
    partner_id: effectivePartnerId ?? null,
    recommended_facility_id: facility?.id ?? null,
    recommended_facility_name: facility?.name ?? null,
    recommended_partner_id: partnerId ?? null,
    recommended_partner_name: partnerName ?? null,
    intended_outcome: intendedOutcome,
    intended_outcome_display: (plan.intended_outcomes ?? [])[0] ?? "Recycle",
    rationale,
    actions,
  };
}

// ---------------------------------------------------------------------------
// Diversion totals from stream plans (tonnes)
// ---------------------------------------------------------------------------

function computeDiversionTotals(streamPlans: StreamPlanItem[]): {
  diverted: number;
  landfill: number;
  unknown: number;
  total: number;
} {
  let diverted = 0,
    landfill = 0,
    unknown = 0;
  for (const s of streamPlans) {
    const t = s.total_tonnes;
    if (s.intended_outcome === "recycle" || s.intended_outcome === "reuse") diverted += t;
    else if (s.intended_outcome === "landfill") landfill += t;
    else unknown += t;
  }
  const total = diverted + landfill + unknown;
  return { diverted, landfill, unknown, total };
}

// ---------------------------------------------------------------------------
// Build recommendations list (deterministic rules) — expanded schema
// ---------------------------------------------------------------------------

function pushRec(
  recs: StrategyRecommendation[],
  r: Omit<StrategyRecommendation, "id">,
  category: RecommendationCategory
): void {
  recs.push({
    ...r,
    id: nextRecId(category, r.title),
    estimated_impact: {
      ...r.estimated_impact,
      notes: toNotes(r.estimated_impact.notes as string[] | string | undefined),
    },
  });
}

function buildRecommendations(
  streamPlans: StreamPlanItem[],
  totalTonnes: number,
  unallocatedForecastCount: number,
  conversionRequiredCount: number,
  forecastItems: ForecastItemForStrategy[],
  unknownTonnes: number
): StrategyRecommendation[] {
  recIdCounter = 0;
  const recs: StrategyRecommendation[] = [];
  const priorityOrder: RecommendationPriority[] = ["high", "medium", "low"];
  const [costLow, costHigh] = getCostSavingPerTonnesDivertedFromLandfill();
  const [carbonLow, carbonHigh] = getCarbonSavingPerTonnesDivertedTco2e();

  // ----- Data quality -----
  if (conversionRequiredCount > 0) {
    pushRec(
      recs,
      {
        title: "Fix unit conversions",
        description: `${conversionRequiredCount} forecast item(s) use units that cannot be converted to weight (e.g. m³ or m² without density/thickness). Add density or thickness so these items contribute to stream totals.`,
        priority: "high",
        confidence: "high",
        category: "data_quality",
        triggers: ["forecast_items_conversion_required"],
        estimated_impact: {
          notes: ["Add density (kg/m³) or thickness (m) for m²/m³ units so tonnes can be calculated."],
        },
        implementation_steps: [
          "Review forecast items with non-weight units (m³, m², m).",
          "Add density_kg_m3 or thickness_m where applicable, or switch unit to tonne.",
          "Re-run forecast sync so stream totals include these items.",
        ],
      },
      "data_quality"
    );
  }

  if (unallocatedForecastCount > 0) {
    pushRec(
      recs,
      {
        title: "Allocate forecast items to streams",
        description: `${unallocatedForecastCount} forecast item(s) have no waste stream assigned and are not included in diversion totals.`,
        priority: totalTonnes > 0 && unallocatedForecastCount >= 1 ? "high" : "medium",
        confidence: "high",
        category: "data_quality",
        triggers: ["unallocated_forecast_items"],
        estimated_impact: {
          notes: ["Including these will improve accuracy of tonnes and diversion %."],
        },
        implementation_steps: [
          "In Forecasting, assign a waste stream to each item (e.g. material type match or Mixed C&D).",
          "Save; stream totals will update automatically.",
        ],
        apply_action: { type: "allocate_to_mixed", payload: { unallocated_count: unallocatedForecastCount } },
      },
      "data_quality"
    );
  }

  const hasUnknownOutcome = streamPlans.some((s) => s.intended_outcome === "unknown");
  const unknownPercent = totalTonnes > 0 ? (unknownTonnes / totalTonnes) * 100 : 0;
  if (unknownPercent > 20 && hasUnknownOutcome) {
    pushRec(
      recs,
      {
        title: "Select disposal method for streams",
        description: `${unknownPercent.toFixed(0)}% of tonnes have no disposal method set. Select Recycle/Reuse/Landfill per stream to fix diversion reporting.`,
        priority: "medium",
        confidence: "high",
        category: "data_quality",
        triggers: ["outcomes_unknown_high_percent"],
        estimated_impact: { notes: ["Accurate outcomes enable diversion % and facility reporting."] },
        implementation_steps: ["In Inputs, select a disposal method for each waste stream plan."],
        apply_action: { type: "set_outcome", payload: {} },
      },
      "data_quality"
    );
  }

  // ----- Source separation -----
  const mixedStream = streamPlans.find((s) => s.stream_name === MIXED_CD_KEY);
  const mixedTonnes = mixedStream?.total_tonnes ?? 0;
  const mixedPercent = totalTonnes > 0 ? (mixedTonnes / totalTonnes) * 100 : 0;

  if (mixedPercent > 40 && totalTonnes > 0) {
    const topRecyclable = streamPlans
      .filter(
        (s) =>
          s.stream_name !== MIXED_CD_KEY &&
          (s.intended_outcome === "recycle" || s.intended_outcome === "reuse") &&
          s.total_tonnes > 0 &&
          s.handling_mode === "mixed"
      )
      .sort((a, b) => b.total_tonnes - a.total_tonnes)
      .slice(0, 3);
    if (topRecyclable.length > 0) {
      const streamNames = topRecyclable.map((s) => s.stream_name).join(", ");
      const totalTop = topRecyclable.reduce((sum, s) => sum + s.total_tonnes, 0);
      const tonnesDiverted = totalTop;
      const divDelta = totalTonnes > 0 ? (tonnesDiverted / totalTonnes) * 100 : 0;
      pushRec(
        recs,
        {
          title: "Separate top recyclable streams to reduce Mixed C&D",
          description: `Mixed C&D is ${mixedPercent.toFixed(0)}% of total waste. Separating the top 1–3 recyclable streams (${streamNames}) onsite will improve diversion and often reduce cost.`,
          priority: mixedPercent >= 60 ? "high" : "medium",
          confidence: "medium",
          category: "source_separation",
          triggers: ["mixed_cd_over_40_percent"],
          estimated_impact: {
            tonnes_diverted: tonnesDiverted,
            diversion_delta_percent: divDelta,
            cost_savings_nzd_range: [Math.round(tonnesDiverted * costLow), Math.round(tonnesDiverted * costHigh)],
            carbon_savings_tco2e_range: [
              Math.round(tonnesDiverted * carbonLow * 100) / 100,
              Math.round(tonnesDiverted * carbonHigh * 100) / 100,
            ],
            notes: [NOTE_APPROXIMATE_RANGES],
          },
          implementation_steps: [
            "Add dedicated skip/bin for each stream (e.g. Metals, Timber, Plasterboard).",
            "Site signage and toolbox talk on what goes where.",
            "Assign facilities for each separated stream in Inputs.",
          ],
        },
        "source_separation"
      );
    }
  }

  const majorRecyclableToSeparate = streamPlans.filter(
    (s) =>
      s.stream_name !== MIXED_CD_KEY &&
      s.total_tonnes >= 1.0 &&
      (s.intended_outcome === "recycle" || s.intended_outcome === "reuse") &&
      s.recommended_handling === "separate" &&
      s.handling_mode !== "separated"
  );
  for (const s of majorRecyclableToSeparate) {
    const tonnesDiverted = s.total_tonnes;
    const divDelta = totalTonnes > 0 ? (tonnesDiverted / totalTonnes) * 100 : 0;
    pushRec(
      recs,
      {
        title: `Separate ${s.stream_name} onsite`,
        description: `This stream has ${s.total_tonnes.toFixed(1)} t and is recyclable; separating it onsite improves diversion and reporting.`,
        priority: tonnesDiverted / totalTonnes >= 0.2 ? "high" : tonnesDiverted / totalTonnes >= 0.05 ? "medium" : "low",
        confidence: "high",
        category: "source_separation",
        triggers: ["recyclable_stream_1t_plus", "recommended_handling_separate"],
        estimated_impact: {
          tonnes_diverted: tonnesDiverted,
          diversion_delta_percent: divDelta,
          cost_savings_nzd_range: [Math.round(tonnesDiverted * costLow), Math.round(tonnesDiverted * costHigh)],
          carbon_savings_tco2e_range: [
            Math.round(tonnesDiverted * carbonLow * 100) / 100,
            Math.round(tonnesDiverted * carbonHigh * 100) / 100,
          ],
          notes: [NOTE_APPROXIMATE_RANGES],
        },
        implementation_steps: [
          "Provide dedicated skip/bin for " + s.stream_name + ".",
          "Add clear signage and include in toolbox talks.",
          "Assign a facility that accepts " + s.stream_name + " in Inputs.",
        ],
        apply_action: { type: "mark_stream_separate", payload: { stream_name: s.stream_name } },
      },
      "source_separation"
    );
  }

  const plasterboardStream = streamPlans.find(
    (s) => s.stream_name.toLowerCase().includes("plasterboard") || s.stream_name.toLowerCase().includes("gib")
  );
  if (plasterboardStream && mixedPercent > 40 && totalTonnes > 0 && plasterboardStream.handling_mode !== "separated") {
      pushRec(
        recs,
        {
          title: "Separate plasterboard / GIB",
          description: "Plasterboard separation is a common council and client target. Mixed C&D dominates; adding a dedicated plasterboard stream improves diversion and compliance.",
          priority: plasterboardStream.total_tonnes >= 0.5 ? "high" : "medium",
          confidence: "high",
          category: "source_separation",
          triggers: ["plasterboard_present", "mixed_dominates"],
          estimated_impact: {
            tonnes_diverted: plasterboardStream.total_tonnes,
            diversion_delta_percent: totalTonnes > 0 ? (plasterboardStream.total_tonnes / totalTonnes) * 100 : 0,
            notes: [NOTE_APPROXIMATE_RANGES],
          },
          implementation_steps: [
            "Dedicated plasterboard/GIB skip; keep dry and separate from general mixed.",
            "Signage and brief trades on plasterboard-only bin.",
            "Select a facility that accepts Plasterboard / GIB.",
          ],
          apply_action: { type: "create_stream", payload: { stream_name: "Plasterboard / GIB" } },
        },
        "source_separation"
      );
  }

  // ----- Facility optimisation -----
  const missingFacility = streamPlans.filter((s) => s.total_tonnes > 0 && !s.assigned_facility_id);
  for (const s of missingFacility) {
    pushRec(
      recs,
      {
        title: `Choose facility for ${s.stream_name}`,
        description: `No facility is assigned for ${s.stream_name}. Select a destination with the best diversion rate to enable reporting and maximise recovery.`,
        priority: s.total_tonnes / totalTonnes >= 0.2 ? "high" : "medium",
        confidence: "high",
        category: "facility_optimisation",
        triggers: ["facility_missing"],
        estimated_impact: { notes: ["Required for compliant reporting; choose a facility that accepts this stream."] },
        implementation_steps: ["In Inputs, select a partner and facility for this stream.", "Confirm accepted stream types with the facility."],
        apply_action: {
          type: "set_facility",
          payload: {
            stream_name: s.stream_name,
            facility_id: s.recommended_facility_id ?? null,
            partner_id: s.recommended_partner_id ?? null,
          },
        },
      },
      "facility_optimisation"
    );
  }

  // ----- Procurement reduction (forecast-driven) -----
  const allocatedItems = forecastItems.filter((i) => (i.waste_stream_key ?? "").trim() !== "" && i.waste_kg != null && i.waste_kg >= 0);
  const totalForecastTonnes = allocatedItems.reduce((sum, i) => sum + (i.waste_kg ?? 0) / 1000, 0);
  const sortedByWaste = [...allocatedItems].sort((a, b) => (b.waste_kg ?? 0) - (a.waste_kg ?? 0));
  const top5Waste = sortedByWaste.slice(0, 5).reduce((sum, i) => sum + (i.waste_kg ?? 0) / 1000, 0);
  const top5Percent = totalForecastTonnes > 0 ? (top5Waste / totalForecastTonnes) * 100 : 0;
  if (top5Percent > 50 && totalForecastTonnes > 0) {
    pushRec(
      recs,
      {
        title: "Reduce waste at source (top forecast items)",
        description: `The top 5 forecast items contribute ${top5Percent.toFixed(0)}% of forecast waste. Review ordering margins, take-back schemes, and supplier packaging to reduce at source.`,
        priority: "medium",
        confidence: "medium",
        category: "procurement_reduction",
        triggers: ["top_5_items_over_50_percent_forecast"],
        estimated_impact: {
          notes: ["Reducing overordering and packaging can lower tonnes and cost; impact depends on contracts and suppliers."],
        },
        implementation_steps: [
          "Review top forecast items (quantity and excess %) in Forecasting.",
          "Discuss with procurement: ordering margins, design for less waste, take-back.",
          "Update quantities or excess % as practices change.",
        ],
      },
      "procurement_reduction"
    );
  }

  const highExcessItems = forecastItems.filter((i) => (i.excess_percent ?? 0) > 10 && (i.waste_kg ?? 0) > 0);
  const majorHighExcess = highExcessItems.filter((i) => (i.waste_kg ?? 0) / 1000 >= 0.5);
  if (majorHighExcess.length > 0) {
    pushRec(
      recs,
      {
        title: "Tighten ordering margin on major items",
        description: `${majorHighExcess.length} forecast item(s) have excess % over 10% and contribute significant waste. Review design and ordering to reduce surplus.`,
        priority: "medium",
        confidence: "medium",
        category: "procurement_reduction",
        triggers: ["excess_percent_over_10_major_items"],
        estimated_impact: {
          notes: ["Lower excess % or quantities will reduce forecast tonnes and disposal cost."],
        },
        implementation_steps: [
          "In Forecasting, review excess % and quantity for high-waste items.",
          "Align with design/estimating; adjust where overordering is identified.",
        ],
      },
      "procurement_reduction"
    );
  }

  // ----- Site logistics -----
  const separatedCount = streamPlans.filter((s) => s.recommended_handling === "separate" && s.stream_name !== MIXED_CD_KEY).length;
  if (separatedCount >= 3) {
    pushRec(
      recs,
      {
        title: "Document bin layout plan",
        description: `With ${separatedCount} separated streams, a clear bin layout plan reduces contamination and supports collection efficiency.`,
        priority: "medium",
        confidence: "high",
        category: "site_logistics",
        triggers: ["three_plus_separated_streams"],
        estimated_impact: { notes: ["Improves segregation compliance and reduces contamination."] },
        implementation_steps: [
          "Draw or list bin/skip locations by stream (e.g. site plan).",
          "Include in site induction and toolbox talks.",
          "Review access for collection vehicles.",
        ],
      },
      "site_logistics"
    );
  }

  if (totalTonnes > 0) {
    const cadence = totalTonnes >= 10 ? "weekly" : totalTonnes >= 3 ? "weekly or fortnightly" : "fortnightly or as needed";
    pushRec(
      recs,
      {
        title: "Set collection cadence",
        description: `Estimated ${totalTonnes.toFixed(1)} t total waste. Recommend ${cadence} collection to avoid overflow and maintain segregation.`,
        priority: "low",
        confidence: "medium",
        category: "site_logistics",
        triggers: ["total_tonnes_estimated"],
        estimated_impact: { notes: ["Match cadence to fill rates and contract; adjust as project progresses."] },
        implementation_steps: ["Agree collection frequency with waste contractor.", "Document in SWMP and logistics plan."],
      },
      "site_logistics"
    );
  }

  const highValueRecyclable = streamPlans.filter(
    (s) =>
      s.stream_name !== MIXED_CD_KEY &&
      (s.intended_outcome === "recycle" || s.intended_outcome === "reuse") &&
      s.total_tonnes >= 0.5
  );
  if (highValueRecyclable.length >= 1) {
    pushRec(
      recs,
      {
        title: "Contamination controls for recycling streams",
        description: "High-value recycling streams (e.g. Metals, Timber, Plasterboard) benefit from clear signage and bin lids to reduce contamination.",
        priority: "medium",
        confidence: "high",
        category: "site_logistics",
        triggers: ["recyclable_streams_present"],
        estimated_impact: { notes: ["Reduces reject loads and improves recovery rates."] },
        implementation_steps: [
          "Signage at each recycling bin (what goes in; no other materials).",
          "Lids or covers where practical to prevent mixing.",
          "Brief trades regularly on contamination.",
        ],
      },
      "site_logistics"
    );
  }

  // Dedupe by title
  const seen = new Set<string>();
  const deduped = recs.filter((r) => {
    if (seen.has(r.title)) return false;
    seen.add(r.title);
    return true;
  });

  // Sort: priority (high -> low), then by tonnes impacted (desc)
  const tonnesImpacted = (r: StrategyRecommendation) => r.estimated_impact?.tonnes_diverted ?? 0;
  return deduped.sort((a, b) => {
    const p = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    if (p !== 0) return p;
    return tonnesImpacted(b) - tonnesImpacted(a);
  });
}

// ---------------------------------------------------------------------------
// Narrative paragraphs
// ---------------------------------------------------------------------------

function buildNarrative(
  summary: WasteStrategySummary,
  streamPlans: StreamPlanItem[],
  hasUnknown: boolean,
  recommendations: StrategyRecommendation[]
): WasteStrategyNarrative {
  const { total_estimated_tonnes, estimated_diversion_percent, estimated_landfill_percent, streams_count, facilities_utilised_count } = summary;

  const swmp_summary_paragraph =
    `This waste strategy covers ${streams_count} stream(s) with an estimated total of ${total_estimated_tonnes.toFixed(1)} tonnes. ` +
    `Estimated diversion is ${estimated_diversion_percent.toFixed(0)}% with ${estimated_landfill_percent.toFixed(0)}% to landfill. ` +
    `${facilities_utilised_count} facility/facilities are utilised across the streams.`;

  const methodology_paragraph =
    "Recommendations are generated deterministically from stream tonnages (manual + forecast), intended outcomes, and facility options. " +
    "Streams are classified by significance (major ≥1 t, medium 0.2–1 t, minor <0.2 t). " +
    "Recyclable/reusable major or medium streams are recommended for separation; minor streams may remain mixed unless hazardous. " +
    "Facility selection prefers existing assigned facilities that accept the stream, then best match by accepted stream type and diversion rate.";

  const key_assumptions: string[] = [
    "Tonnages include both manual entries and forecast-allocated quantities.",
    "Diversion includes Recycle, Reuse, Recover, Cleanfill and Reduce outcomes; Landfill is counted separately.",
  ];
  if (hasUnknown) {
    key_assumptions.push("Streams with no intended outcome or unknown outcome are excluded from diversion % denominator in impact estimates; narrative includes them where relevant.");
  }

  const facilityList = streamPlans
    .filter((s) => s.recommended_facility_name)
    .map((s) => `${s.stream_name}: ${s.recommended_facility_name}`);
  const facility_plan_paragraph =
    facilityList.length > 0
      ? "Facility plan: " + facilityList.join("; ") + "."
      : "No facilities are currently assigned; assign facilities per stream for compliant reporting.";

  const top_recommendations_bullets = recommendations
    .slice(0, RECOMMENDATION_DISPLAY_LIMIT)
    .map((r) => r.title);

  const drivers: string[] = [];
  if (estimated_diversion_percent > 0) {
    drivers.push(`Estimated diversion of ${estimated_diversion_percent.toFixed(0)}% is driven by recyclable streams (e.g. ${streamPlans.filter((s) => s.intended_outcome === "recycle" || s.intended_outcome === "reuse").map((s) => s.stream_name).slice(0, 3).join(", ") || "recycling streams"}) and facility choices.`);
  }
  const mixedPlan = streamPlans.find((s) => s.stream_name === MIXED_CD_KEY);
  if (mixedPlan && mixedPlan.total_tonnes > 0 && total_estimated_tonnes > 0) {
    const pct = (mixedPlan.total_tonnes / total_estimated_tonnes) * 100;
    if (pct > 30) drivers.push(`Mixed C&D represents ${pct.toFixed(0)}% of total waste; increasing source separation would improve diversion.`);
  }
  const major_drivers_paragraph = drivers.length > 0 ? drivers.join(" ") : "Key drivers will depend on stream mix and facility selection; review recommendations above.";

  return {
    swmp_summary_paragraph,
    methodology_paragraph,
    key_assumptions,
    facility_plan_paragraph,
    top_recommendations_bullets,
    major_drivers_paragraph,
  };
}

// ---------------------------------------------------------------------------
// Count unallocated and conversion_required from forecast items (read-only)
// ---------------------------------------------------------------------------

type ForecastRow = {
  quantity: number;
  excess_percent: number;
  unit: string | null;
  kg_per_m: number | null;
  waste_stream_key: string | null;
  item_name?: string | null;
};

export type ForecastItemForStrategy = {
  quantity: number;
  excess_percent: number;
  unit: string | null;
  kg_per_m: number | null;
  waste_stream_key: string | null;
  item_name?: string | null;
  waste_kg: number | null;
};

async function getForecastCountsAndItems(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  unallocated_count: number;
  conversion_required_count: number;
  items: ForecastItemForStrategy[];
}> {
  const [conversionMap, itemsResult] = await Promise.all([
    getConversionOptions(supabase),
    supabase
      .from("project_forecast_items")
      .select("quantity, excess_percent, unit, kg_per_m, waste_stream_key, item_name")
      .eq("project_id", projectId),
  ]);
  const { data: rows, error } = itemsResult;
  if (error) return { unallocated_count: 0, conversion_required_count: 0, items: [] };
  const raw = (rows ?? []) as ForecastRow[];
  let unallocated = 0,
    conversionRequired = 0;
  const items: ForecastItemForStrategy[] = [];
  for (const row of raw) {
    const streamKey = row.waste_stream_key != null && String(row.waste_stream_key).trim() !== "" ? String(row.waste_stream_key).trim() : null;
    const streamOpts = streamKey ? conversionMap.get(streamKey) : undefined;
    const kgPerM = row.kg_per_m != null && Number.isFinite(Number(row.kg_per_m)) ? Number(row.kg_per_m) : (streamOpts?.kgPerM ?? null);
    const densityKgM3 = streamOpts?.densityKgM3 ?? null;
    const wasteQty = calcWasteQty(Number(row.quantity) ?? 0, Number(row.excess_percent) ?? 0);
    const wasteKg = toWasteKg(wasteQty, (row.unit ?? "tonne").toString(), { kgPerM, densityKgM3 });
    if (!streamKey) unallocated += 1;
    else if (wasteKg == null || !Number.isFinite(wasteKg)) conversionRequired += 1;
    items.push({
      quantity: row.quantity,
      excess_percent: row.excess_percent,
      unit: row.unit,
      kg_per_m: row.kg_per_m,
      waste_stream_key: row.waste_stream_key,
      item_name: row.item_name,
      waste_kg: wasteKg,
    });
  }
  return { unallocated_count: unallocated, conversion_required_count: conversionRequired, items };
}

// ---------------------------------------------------------------------------
// Main entry: buildWasteStrategy(projectId, supabaseClient)
// ---------------------------------------------------------------------------

export async function buildWasteStrategy(
  projectId: string,
  supabaseClient: SupabaseClient
): Promise<WasteStrategyResult> {
  const [inputsResult, projectResult, countsAndItems, distancesResult, streamsWithConfiguredFactors] =
    await Promise.all([
      supabaseClient
        .from("swmp_inputs")
        .select(SWMP_INPUTS_JSON_COLUMN)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseClient
        .from("projects")
        .select("id, region, primary_waste_contractor_partner_id")
        .eq("id", projectId)
        .single(),
      getForecastCountsAndItems(supabaseClient, projectId),
      Promise.resolve(
        supabaseClient
          .from("project_facility_distances")
          .select("facility_id, distance_m, duration_s")
          .eq("project_id", projectId)
      ).catch(() => ({ data: [] as DistanceRow[], error: null })),
      getStreamsWithConfiguredFactors(supabaseClient),
    ]);

  const rawInputs = (inputsResult.data as { inputs?: unknown } | null)?.inputs ?? null;
  const inputs = rawInputs ? normalizeSwmpInputs(rawInputs) : null;
  const project = projectResult.data as { region?: string | null; primary_waste_contractor_partner_id?: string | null } | null;
  const region = project?.region ?? null;
  const projectPartnerId = project?.primary_waste_contractor_partner_id ?? null;

  const plans = inputs?.waste_stream_plans ?? [];
  const {
    unallocated_count: unallocatedForecastCount,
    conversion_required_count: conversionRequiredCount,
    items: forecastItems,
  } = countsAndItems;

  const distanceRows = (distancesResult.data ?? []) as DistanceRow[];
  const distanceMap = buildDistanceMapFromRows(distanceRows);

  const streamPlans: StreamPlanItem[] = [];
  /** Distinct facility_id from waste streams where total_tonnes > 0 and facility_id is not null. */
  const utilisedFacilityIds = new Set<string>();
  /** Stream names that needed conversion (m/m3/m2) but had no configured factor — used fallback. */
  const conversionFallbackStreams = new Set<string>();

  for (const plan of plans) {
    const streamName = (plan.category ?? "").trim() || MIXED_CD_KEY;
    const usedManualQtyTonnes =
      plan.manual_qty_tonnes != null &&
      Number.isFinite(plan.manual_qty_tonnes) &&
      plan.manual_qty_tonnes >= 0;
    const manualTonnes = usedManualQtyTonnes
      ? plan.manual_qty_tonnes
      : (planManualQtyToTonnes(
          {
            estimated_qty: plan.estimated_qty,
            unit: plan.unit,
            density_kg_m3: plan.density_kg_m3,
            thickness_m: plan.thickness_m,
          },
          streamName
        ) ?? 0);
    if (
      !usedManualQtyTonnes &&
      plan.estimated_qty != null &&
      Number.isFinite(plan.estimated_qty) &&
      plan.estimated_qty >= 0
    ) {
      const unit = (plan.unit ?? getDefaultUnitForStreamLabel(streamName))
        .toString()
        .toLowerCase()
        .trim();
      if ((unit === "m" || unit === "m3" || unit === "m2") && !streamsWithConfiguredFactors.has(streamName)) {
        conversionFallbackStreams.add(streamName);
      }
    }
    const forecastTonnes =
      plan.forecast_qty != null && Number.isFinite(plan.forecast_qty) && plan.forecast_qty >= 0
        ? plan.forecast_qty
        : 0;
    const totalTonnes = (manualTonnes ?? 0) + forecastTonnes;
    const facilityId = plan.facility_id != null && String(plan.facility_id).trim() !== "" ? String(plan.facility_id).trim() : null;
    if (totalTonnes > 0 && facilityId != null) {
      utilisedFacilityIds.add(facilityId);
    }
    streamPlans.push(
      buildStreamPlan(plan, manualTonnes ?? 0, forecastTonnes, region, projectPartnerId, distanceMap)
    );
  }

  const missingKeys = Array.from(conversionFallbackStreams);
  const conversionsUsed: ConversionsUsed = {
    usedFallback: missingKeys.length > 0,
    fallbackCount: missingKeys.length,
    missingKeys,
  };

  const { diverted, landfill, unknown, total } = computeDiversionTotals(streamPlans);
  const diversionPercent = total > 0 ? (diverted / total) * 100 : 0;
  const landfillPercent = total > 0 ? (landfill / total) * 100 : 0;
  const facilitiesUtilisedCount = utilisedFacilityIds.size;
  const facilityIdsList = Array.from(utilisedFacilityIds);

  if (process.env.NODE_ENV === "development") {
    console.debug("[wasteStrategyBuilder] Overview metrics:", {
      streamCount: streamPlans.length,
      facilitiesUtilisedCount,
      facilityIds: facilityIdsList,
    });
  }

  const summary: WasteStrategySummary = {
    total_estimated_tonnes: total,
    estimated_diversion_percent: diversionPercent,
    estimated_landfill_percent: landfillPercent,
    streams_count: streamPlans.length,
    facilities_utilised_count: facilitiesUtilisedCount,
  };

  const recommendations = buildRecommendations(
    streamPlans,
    total,
    unallocatedForecastCount,
    conversionRequiredCount,
    forecastItems,
    unknown
  );

  const narrative = buildNarrative(summary, streamPlans, unknown > 0, recommendations);

  return {
    summary,
    streamPlans,
    recommendations,
    narrative,
    conversionsUsed,
  };
}
