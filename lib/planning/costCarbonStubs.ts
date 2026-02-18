/**
 * Cost and carbon estimate stubs for the Facility Optimiser.
 * TODO: Replace with full cost/carbon module when implemented.
 * - computeCostEstimate: integrate with pricing/contract data per facility and stream.
 * - computeCarbonEstimate: integrate with emissions factors and transport mode.
 * Optimiser scoring already falls back to distance-only when these return null.
 */

/**
 * Stub: returns null until cost module is implemented.
 * Future: return estimated cost ($) for sending given tonnes from project to facility for stream.
 */
export function computeCostEstimate(
  _projectId: string,
  _facilityId: string,
  _streamName: string,
  _tonnes: number
): number | null {
  return null;
}

/**
 * Stub: returns null until carbon module is implemented.
 * Future: return estimated carbon (kg CO2e) for sending given tonnes from project to facility for stream.
 */
export function computeCarbonEstimate(
  _projectId: string,
  _facilityId: string,
  _streamName: string,
  _tonnes: number
): number | null {
  return null;
}
