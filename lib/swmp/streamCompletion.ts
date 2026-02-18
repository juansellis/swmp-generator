/**
 * Single source of truth for waste stream completion status.
 * Used by: inputs table rows, inputs stream cards, builder progress.
 * Ensures table and card always show the same status for the same plan.
 */

import type { WasteStreamPlanInput } from "./model";

/** Plan-like shape for completion check (subset of WasteStreamPlanInput). */
export type PlanForCompletion = Pick<
  WasteStreamPlanInput,
  | "destination_mode"
  | "facility_id"
  | "custom_destination_name"
  | "custom_destination_address"
  | "custom_destination_place_id"
  | "destination_override"
  | "destination"
  | "intended_outcomes"
  | "manual_qty_tonnes"
  | "forecast_qty"
>;

export type StreamCompletionOptions = {
  /** If true, stream is complete only when total tonnes > 0. Default false for status badge (disposal + destination enough). */
  requireTonnes?: boolean;
};

/**
 * Returns true when destination is set from plan data only (no catalog lookup).
 * - Facility mode: facility_id is non-empty.
 * - Custom mode: at least one of custom_destination_name, custom_destination_address,
 *   custom_destination_place_id, destination_override, or legacy destination is set.
 */
export function hasDestinationSet(plan: PlanForCompletion | null | undefined): boolean {
  if (!plan) return false;
  const mode = plan.destination_mode;
  if (mode === "custom") {
    const name = (plan.custom_destination_name ?? "").trim();
    const address = (plan.custom_destination_address ?? "").trim();
    const placeId = (plan.custom_destination_place_id ?? "").trim();
    const override = (plan.destination_override ?? "").trim();
    const legacy = (plan.destination ?? "").trim();
    return name !== "" || address !== "" || placeId !== "" || override !== "" || legacy !== "";
  }
  return plan.facility_id != null && String(plan.facility_id).trim() !== "";
}

/**
 * Returns true when disposal method is set (single value; length > 0).
 */
export function hasDisposalSet(plan: PlanForCompletion | null | undefined): boolean {
  return (plan?.intended_outcomes?.length ?? 0) > 0;
}

/**
 * Total planned tonnes from plan (manual + forecast). Use for optional tonnes check.
 */
export function getTotalTonnes(plan: PlanForCompletion | null | undefined): number {
  if (!plan) return 0;
  const manual = plan.manual_qty_tonnes != null && Number.isFinite(plan.manual_qty_tonnes) && plan.manual_qty_tonnes >= 0
    ? plan.manual_qty_tonnes
    : 0;
  const forecast = plan.forecast_qty != null && Number.isFinite(plan.forecast_qty) && plan.forecast_qty >= 0
    ? plan.forecast_qty
    : 0;
  return manual + forecast;
}

/**
 * Single source of truth for "Complete" vs "Needs attention".
 * Complete when: disposal set, destination set, and (if requireTonnes) total tonnes > 0.
 */
export function computeWasteStreamCompletion(
  plan: PlanForCompletion | null | undefined,
  options: StreamCompletionOptions = {}
): boolean {
  if (!plan) return false;
  const { requireTonnes = false } = options;
  if (!hasDisposalSet(plan)) return false;
  if (!hasDestinationSet(plan)) return false;
  if (requireTonnes && getTotalTonnes(plan) <= 0) return false;
  return true;
}
