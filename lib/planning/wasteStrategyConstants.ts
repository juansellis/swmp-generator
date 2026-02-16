/**
 * Heuristics for Waste Strategy Builder: cost and carbon assumptions.
 * All values are approximate and used to produce ranges in recommendations.
 * Update when better project- or region-specific data is available.
 */

// ---------------------------------------------------------------------------
// Cost assumptions (NZD per tonne, indicative)
// Used to estimate cost_savings_nzd_range when diverting from landfill/mixed to recycling.
// Sources: typical NZ landfill gate fees, mixed C&D disposal, recycling rebates/costs.
// ---------------------------------------------------------------------------

/** Landfill gate fee (NZD/t) — typical range for NZ C&D. */
export const LANDFILL_COST_PER_TONNE_MIN = 80;
export const LANDFILL_COST_PER_TONNE_MAX = 180;

/** Mixed C&D transfer/disposal (NZD/t) — often lower than landfill but higher than recycling. */
export const MIXED_COST_PER_TONNE_MIN = 60;
export const MIXED_COST_PER_TONNE_MAX = 140;

/** Recycling/recovery cost (NZD/t). Can be negative (rebate) for metals; positive for others. */
export const RECYCLING_COST_PER_TONNE_MIN = -50; // e.g. metals rebate
export const RECYCLING_COST_PER_TONNE_MAX = 80;

/** Cost saving per tonne when moving from landfill to recycling (NZD). Conservative range. */
export function getCostSavingPerTonnesDivertedFromLandfill(): [number, number] {
  const landfillAvg = (LANDFILL_COST_PER_TONNE_MIN + LANDFILL_COST_PER_TONNE_MAX) / 2;
  const recycleMin = RECYCLING_COST_PER_TONNE_MIN;
  const recycleMax = RECYCLING_COST_PER_TONNE_MAX;
  const low = Math.max(0, landfillAvg - recycleMax);
  const high = landfillAvg - recycleMin;
  return [Math.round(low), Math.round(high)];
}

/** Cost saving per tonne when moving from mixed to separated recycling (NZD). */
export function getCostSavingPerTonnesDivertedFromMixed(): [number, number] {
  const mixedAvg = (MIXED_COST_PER_TONNE_MIN + MIXED_COST_PER_TONNE_MAX) / 2;
  const recycleMin = RECYCLING_COST_PER_TONNE_MIN;
  const recycleMax = RECYCLING_COST_PER_TONNE_MAX;
  const low = Math.max(0, mixedAvg - recycleMax);
  const high = mixedAvg - recycleMin;
  return [Math.round(low), Math.round(high)];
}

// ---------------------------------------------------------------------------
// Carbon assumptions (tCO2e per tonne, indicative)
// Used to estimate carbon_savings_tco2e_range. Avoided landfill methane + transport.
// NZ-specific factors are approximate; use conservative ranges with notes when uncertain.
// ---------------------------------------------------------------------------

/** Landfill emissions factor (tCO2e/t waste) — embodied in avoided landfill. Conservative. */
export const LANDFILL_EMISSION_FACTOR_TCO2E_PER_T = 0.3;

/** Recycling displacement (tCO2e/t) — avoided virgin production. Varies by material. */
export const RECYCLING_DISPLACEMENT_TCO2E_PER_T_MIN = 0.1;
export const RECYCLING_DISPLACEMENT_TCO2E_PER_T_MAX = 0.6;

/** Carbon saving per tonne diverted from landfill to recycling (tCO2e). Range. */
export function getCarbonSavingPerTonnesDivertedTco2e(): [number, number] {
  const low = LANDFILL_EMISSION_FACTOR_TCO2E_PER_T * 0.5 + RECYCLING_DISPLACEMENT_TCO2E_PER_T_MIN;
  const high = LANDFILL_EMISSION_FACTOR_TCO2E_PER_T * 1.2 + RECYCLING_DISPLACEMENT_TCO2E_PER_T_MAX;
  return [Math.round(low * 100) / 100, Math.round(high * 100) / 100];
}

/** Note to attach when carbon/cost ranges are approximate. */
export const NOTE_APPROXIMATE_RANGES =
  "Cost and carbon ranges are indicative using standard assumptions; actual savings depend on facility, region, and material.";
