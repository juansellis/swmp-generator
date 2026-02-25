/**
 * Facility scoring engine for the Optimiser.
 * Normalises values to 0–1 (higher = better for score), then weighted sum.
 * Missing dimensions are omitted; if only distance has data, falls back to distance-only.
 */

export type ScoreWeights = {
  distanceWeight: number;
  costWeight: number;
  carbonWeight: number;
  diversionWeight: number;
};

export type FacilityScoreInput = {
  /** km; lower is better */
  distance_km: number | null;
  /** $/tonne; lower is better */
  cost_per_tonne: number | null;
  /** kg CO₂e per tonne; lower is better */
  carbon_factor: number | null;
  /** 0–100 or similar; higher is better */
  diversion_rating: number | null;
};

const DEFAULT_WEIGHTS: ScoreWeights = {
  distanceWeight: 1,
  costWeight: 0,
  carbonWeight: 0,
  diversionWeight: 0,
};

/**
 * Normalise value to 0–1 where higher = better.
 * For "lower is better" (distance, cost, carbon): use (max - value) / (max - min).
 * For "higher is better" (diversion): use (value - min) / (max - min).
 */
function normaliseLowerIsBetter(values: number[]): Map<number, number> {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return new Map();
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min;
  const map = new Map<number, number>();
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    map.set(i, range <= 0 ? 1 : (max - v) / range);
  });
  return map;
}

function normaliseHigherIsBetter(values: number[]): Map<number, number> {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return new Map();
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min;
  const map = new Map<number, number>();
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    map.set(i, range <= 0 ? 1 : (v - min) / range);
  });
  return map;
}

export type ScoredCandidate<T> = {
  candidate: T;
  score: number;
  /** Which dimensions contributed (for explanation) */
  usedDistance: boolean;
  usedCost: boolean;
  usedCarbon: boolean;
  usedDiversion: boolean;
};

/**
 * Score and rank candidates. Higher score = better.
 * Normalises each dimension across candidates, then weighted sum.
 * If a dimension has no valid values across candidates, it is omitted.
 * If only distance has data, only distance weight is used (fallback).
 */
export function scoreCandidates<T extends FacilityScoreInput>(
  candidates: T[],
  weights: Partial<ScoreWeights> = {}
): ScoredCandidate<T>[] {
  const w: ScoreWeights = { ...DEFAULT_WEIGHTS, ...weights };

  if (candidates.length === 0) return [];

  const distValues = candidates.map((c) => c.distance_km ?? NaN);
  const costValues = candidates.map((c) => c.cost_per_tonne ?? NaN);
  const carbonValues = candidates.map((c) => c.carbon_factor ?? NaN);
  const diversionValues = candidates.map((c) => c.diversion_rating ?? NaN);

  const hasDistance = distValues.some((v) => Number.isFinite(v));
  const hasCost = costValues.some((v) => Number.isFinite(v));
  const hasCarbon = carbonValues.some((v) => Number.isFinite(v));
  const hasDiversion = diversionValues.some((v) => Number.isFinite(v));

  const normDist = normaliseLowerIsBetter(distValues);
  const normCost = normaliseLowerIsBetter(costValues);
  const normCarbon = normaliseLowerIsBetter(carbonValues);
  const normDiversion = normaliseHigherIsBetter(diversionValues);

  const useDistance = hasDistance && w.distanceWeight > 0;
  const useCost = hasCost && w.costWeight > 0;
  const useCarbon = hasCarbon && w.carbonWeight > 0;
  const useDiversion = hasDiversion && w.diversionWeight > 0;

  const totalWeight =
    (useDistance ? w.distanceWeight : 0) +
    (useCost ? w.costWeight : 0) +
    (useCarbon ? w.carbonWeight : 0) +
    (useDiversion ? w.diversionWeight : 0);

  const fallbackDistanceOnly = totalWeight === 0 && hasDistance;
  const effectiveDistW = fallbackDistanceOnly ? 1 : useDistance ? w.distanceWeight : 0;
  const effectiveCostW = fallbackDistanceOnly ? 0 : useCost ? w.costWeight : 0;
  const effectiveCarbonW = fallbackDistanceOnly ? 0 : useCarbon ? w.carbonWeight : 0;
  const effectiveDivW = fallbackDistanceOnly ? 0 : useDiversion ? w.diversionWeight : 0;
  const effectiveTotal =
    effectiveDistW + effectiveCostW + effectiveCarbonW + effectiveDivW || 1;

  const scored: ScoredCandidate<T>[] = candidates.map((c, i) => {
    let score = 0;
    if (effectiveDistW > 0) {
      const n = normDist.get(i);
      if (n != null) score += n * effectiveDistW;
    }
    if (effectiveCostW > 0) {
      const n = normCost.get(i);
      if (n != null) score += n * effectiveCostW;
    }
    if (effectiveCarbonW > 0) {
      const n = normCarbon.get(i);
      if (n != null) score += n * effectiveCarbonW;
    }
    if (effectiveDivW > 0) {
      const n = normDiversion.get(i);
      if (n != null) score += n * effectiveDivW;
    }
    score = effectiveTotal > 0 ? score / effectiveTotal : 0;

    return {
      candidate: c,
      score,
      usedDistance: effectiveDistW > 0 && normDist.has(i),
      usedCost: effectiveCostW > 0 && normCost.has(i),
      usedCarbon: effectiveCarbonW > 0 && normCarbon.has(i),
      usedDiversion: effectiveDivW > 0 && normDiversion.has(i),
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = (a.candidate as FacilityScoreInput).distance_km ?? Infinity;
    const db = (b.candidate as FacilityScoreInput).distance_km ?? Infinity;
    return da - db;
  });

  return scored;
}
