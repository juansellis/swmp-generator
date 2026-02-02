/**
 * Canonical SWMP inputs schema — single source of truth.
 * All UI and API should use these exports for inputs type, defaults, and normalization.
 */

export {
  defaultSwmpInputs,
  normalizeSwmpInputs,
} from "./model";

import type { SwmpInputs, SiteControlsInput } from "./model";
export type { SwmpInputs, SiteControlsInput };

/** JSON column name in swmp_inputs table. Use when reading/writing inputs. */
export const SWMP_INPUTS_JSON_COLUMN = "inputs";

/**
 * Validates SWMP inputs and returns non-blocking warnings (e.g. missing destinations, empty streams).
 * Does not throw; use for UI hints or logging only.
 */
export function validateSwmpInputs(inputs: SwmpInputs): string[] {
  const warnings: string[] = [];

  if (!inputs.waste_streams?.length) {
    warnings.push("No waste streams selected.");
  }

  const target = inputs.target_diversion;
  if (typeof target !== "number" || Number.isNaN(target) || target < 0 || target > 100) {
    warnings.push("Target diversion should be between 0 and 100.");
  }

  const planByCategory = new Map(inputs.waste_stream_plans?.map((p) => [p.category, p]) ?? []);
  for (const stream of inputs.waste_streams ?? []) {
    const plan = planByCategory.get(stream);
    const outcomesSet = (plan?.intended_outcomes?.length ?? 0) > 0;
    const destinationSet =
      (plan?.facility_id != null && plan.facility_id !== "") ||
      ((plan?.destination_override ?? "").trim().length > 0) ||
      ((plan?.destination ?? "").trim().length > 0);
    const distanceProvided = plan?.distance_km != null && plan?.distance_km >= 0;
    if (!outcomesSet) warnings.push(`"${stream}": intended outcomes not set.`);
    if (!destinationSet) warnings.push(`"${stream}": destination not set (select facility or enter custom).`);
    if (!distanceProvided) warnings.push(`"${stream}": distance (km) not provided (0 is OK).`);
  }

  return warnings;
}
