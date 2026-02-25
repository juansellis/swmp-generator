/**
 * Facility Optimiser Engine (pure, testable).
 * Uses lib/optimiser/scoreFacility for normalised weighted scoring.
 * Recommends best facility per waste stream using distance, cost, carbon, diversion.
 * Handles missing data gracefully: falls back to distance-only when others missing.
 */

import { scoreCandidates, type ScoreWeights } from "@/lib/optimiser/scoreFacility";

export type OptimiserWeights = {
  distance?: number;
  cost?: number;
  carbon?: number;
  diversion?: number;
};

export type FacilityCandidate = {
  facility_id: string;
  facility_name: string;
  partner_id?: string | null;
  partner_name?: string | null;
  distance_km: number | null;
  duration_min: number | null;
  /** Optional; if missing, cost term is omitted from score */
  cost_per_tonne?: number | null;
  /** Optional; if missing, carbon term is omitted from score */
  carbon_kg_co2e_per_tonne?: number | null;
  /** Optional; higher is better; 0–100 typical */
  diversion_rating?: number | null;
};

export type StreamInput = {
  stream_name: string;
  planned_tonnes: number;
};

export type OptimiserReason = {
  primary: string;
  breakdown: string[];
  /** Number of facilities eligible for this stream */
  eligibility_count?: number;
  /** 1-based rank of recommended facility by distance among eligible (1 = closest) */
  rank_by_distance?: number;
};

export type OptimiserResultItem = {
  stream_name: string;
  planned_tonnes: number;
  recommended_facility_id: string;
  recommended_facility_name: string;
  /** 0–1 composite score (higher = better); omitted when no eligible facilities */
  score?: number;
  distance_km: number | null;
  duration_min: number | null;
  estimated_cost: number | null;
  estimated_carbon: number | null;
  alternatives: Array<{
    facility_id: string;
    facility_name: string;
    distance_km: number | null;
    duration_min: number | null;
  }>;
  reason: OptimiserReason;
  /** All eligible facilities for this stream (for override dropdown) */
  eligible_facilities: Array<{ facility_id: string; facility_name: string }>;
};

const DEFAULT_WEIGHTS: Required<OptimiserWeights> = {
  distance: 1,
  cost: 0,
  carbon: 0,
  diversion: 0,
};

function toScoreInput(c: FacilityCandidate): { distance_km: number | null; cost_per_tonne: number | null; carbon_factor: number | null; diversion_rating: number | null } {
  return {
    distance_km: c.distance_km != null && Number.isFinite(c.distance_km) ? c.distance_km : null,
    cost_per_tonne: c.cost_per_tonne != null && Number.isFinite(c.cost_per_tonne) ? c.cost_per_tonne : null,
    carbon_factor: c.carbon_kg_co2e_per_tonne != null && Number.isFinite(c.carbon_kg_co2e_per_tonne) ? c.carbon_kg_co2e_per_tonne : null,
    diversion_rating: c.diversion_rating != null && Number.isFinite(c.diversion_rating) ? c.diversion_rating : null,
  };
}

/**
 * Build explainable reason for the chosen facility.
 * Uses eligibility count and distance rank; adds notes for missing data.
 */
function buildReason(
  streamName: string,
  c: FacilityCandidate,
  candidates: FacilityCandidate[],
  rankByDistance: number,
  hasDistance: boolean,
  hasCost: boolean,
  hasCarbon: boolean,
  tonnes: number
): OptimiserReason {
  const eligibility_count = candidates.length;
  const breakdown: string[] = [];
  breakdown.push(`Eligible facilities: ${eligibility_count}`);
  if (eligibility_count === 0) {
    return {
      primary: "No eligible facilities found",
      breakdown: ["No facilities accept this stream."],
      eligibility_count: 0,
    };
  }
  if (eligibility_count === 1) {
    if (hasDistance && c.distance_km != null) {
      breakdown.push(`Distance: ${c.distance_km} km`);
      if (c.duration_min != null) breakdown.push(`Drive: ~${Math.round(c.duration_min)} min`);
    }
    breakdown.push("Meets acceptance criteria for this stream.");
    return {
      primary: "Only eligible facility",
      breakdown,
      eligibility_count: 1,
      rank_by_distance: 1,
    };
  }
  const someMissingDistance = candidates.some(
    (x) => x.distance_km == null || !Number.isFinite(x.distance_km)
  );
  if (someMissingDistance) {
    breakdown.push("Some facilities missing distance; ranked with available data.");
  }
  if (hasDistance && c.distance_km != null) {
    breakdown.push(`Distance rank: #${rankByDistance} by distance`);
    breakdown.push(`Distance: ${c.distance_km} km`);
    if (c.duration_min != null) breakdown.push(`Drive: ~${Math.round(c.duration_min)} min`);
  }
  breakdown.push(`Meets acceptance criteria for ${streamName}.`);
  if (hasCost && c.cost_per_tonne != null && tonnes > 0) {
    breakdown.push(`Est. cost: $${(c.cost_per_tonne * tonnes).toFixed(0)}`);
  }
  if (hasCarbon && c.carbon_kg_co2e_per_tonne != null && tonnes > 0) {
    breakdown.push(`Est. carbon: ${((c.carbon_kg_co2e_per_tonne * tonnes) / 1000).toFixed(2)} tCO2e`);
  }

  let primary: string;
  if (!hasDistance && eligibility_count >= 1) {
    primary = "Eligible facility selected (distance unavailable)";
    breakdown.push("Missing geocode for project or facility; geocode to enable distance ranking.");
  } else if (rankByDistance === 1 && hasDistance) {
    primary = "Closest eligible facility";
  } else if (rankByDistance >= 1 && eligibility_count > 1) {
    primary = `Ranked #${rankByDistance} of ${eligibility_count} by distance`;
  } else if (hasCost) {
    primary = "Lowest cost";
  } else if (hasCarbon) {
    primary = "Lowest carbon";
  } else {
    primary = "Best available option";
  }

  return {
    primary,
    breakdown: breakdown.length ? breakdown : ["No metrics available"],
    eligibility_count,
    rank_by_distance: rankByDistance,
  };
}

export type RunOptimiserInput = {
  streams: StreamInput[];
  /** Per stream: list of eligible facilities with metrics */
  eligiblePerStream: Map<string, FacilityCandidate[]>;
  weights?: OptimiserWeights;
};

/**
 * Run the facility optimiser.
 * For each stream: filter eligible facilities, score by weights, pick best and top-3 alternatives.
 * Handles missing distance/cost/carbon gracefully.
 */
export function runFacilityOptimiser(input: RunOptimiserInput): OptimiserResultItem[] {
  const weights: Required<OptimiserWeights> = {
    distance: input.weights?.distance ?? DEFAULT_WEIGHTS.distance,
    cost: input.weights?.cost ?? DEFAULT_WEIGHTS.cost,
    carbon: input.weights?.carbon ?? DEFAULT_WEIGHTS.carbon,
    diversion: input.weights?.diversion ?? DEFAULT_WEIGHTS.diversion,
  };

  const scoreWeights: ScoreWeights = {
    distanceWeight: weights.distance,
    costWeight: weights.cost,
    carbonWeight: weights.carbon,
    diversionWeight: weights.diversion,
  };

  const results: OptimiserResultItem[] = [];

  for (const stream of input.streams) {
    const candidates = input.eligiblePerStream.get(stream.stream_name) ?? [];
    const tonnes = Math.max(0, Number(stream.planned_tonnes) || 0);

    type WithCandidate = {
      distance_km: number | null;
      cost_per_tonne: number | null;
      carbon_factor: number | null;
      diversion_rating: number | null;
      _c: FacilityCandidate;
    };
    const withCandidate = candidates.map((c) => ({ ...toScoreInput(c), _c: c } as WithCandidate));
    const scored = scoreCandidates(withCandidate, scoreWeights);
    const scoredByCandidate = scored.map((s) => ({
      candidate: (s.candidate as WithCandidate)._c,
      score: s.score,
      hasDistance: s.usedDistance,
      hasCost: s.usedCost,
      hasCarbon: s.usedCarbon,
      hasDiversion: s.usedDiversion,
    }));

    const best = scoredByCandidate[0];
    if (!best) {
      results.push({
        stream_name: stream.stream_name,
        planned_tonnes: tonnes,
        recommended_facility_id: "",
        recommended_facility_name: "",
        score: 0,
        distance_km: null,
        duration_min: null,
        estimated_cost: null,
        estimated_carbon: null,
        alternatives: [],
        reason: {
          primary: "No eligible facilities found",
          breakdown: ["No facilities accept this stream."],
          eligibility_count: 0,
        },
        eligible_facilities: candidates.map((c) => ({
          facility_id: c.facility_id,
          facility_name: c.facility_name,
        })),
      });
      continue;
    }

    const c = best.candidate;
    const byDistance = [...candidates].sort((a, b) => {
      const da = a.distance_km ?? Infinity;
      const db = b.distance_km ?? Infinity;
      if (da !== db) return da - db;
      return (a.facility_name ?? "").localeCompare(b.facility_name ?? "");
    });
    const rankByDistance = Math.max(
      1,
      byDistance.findIndex((x) => x.facility_id === c.facility_id) + 1
    );

    const estimated_cost =
      tonnes > 0 && c.cost_per_tonne != null && Number.isFinite(c.cost_per_tonne)
        ? c.cost_per_tonne * tonnes
        : null;
    const estimated_carbon =
      tonnes > 0 &&
      c.carbon_kg_co2e_per_tonne != null &&
      Number.isFinite(c.carbon_kg_co2e_per_tonne)
        ? (c.carbon_kg_co2e_per_tonne * tonnes) / 1000
        : null;

    const alternatives = scoredByCandidate.slice(1, 4).map(({ candidate: alt }) => ({
      facility_id: alt.facility_id,
      facility_name: alt.facility_name,
      distance_km: alt.distance_km,
      duration_min: alt.duration_min,
    }));

    results.push({
      stream_name: stream.stream_name,
      planned_tonnes: tonnes,
      recommended_facility_id: c.facility_id,
      recommended_facility_name: c.facility_name,
      score: best.score,
      distance_km: c.distance_km,
      duration_min: c.duration_min,
      estimated_cost,
      estimated_carbon,
      alternatives,
      reason: buildReason(
        stream.stream_name,
        c,
        candidates,
        rankByDistance,
        best.hasDistance,
        best.hasCost,
        best.hasCarbon,
        tonnes
      ),
      eligible_facilities: candidates.map((x) => ({
        facility_id: x.facility_id,
        facility_name: x.facility_name,
      })),
    });
  }

  return results;
}
