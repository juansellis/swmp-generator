/**
 * Dashboard / Project Intelligence metrics helpers.
 * Derived rules mirror the SQL in get_dashboard_metrics_intelligence.
 */

/** One row of inputs (e.g. from latest swmp_inputs per project). */
export type LatestInputsRow = { inputs: Record<string, unknown> };

/**
 * Normalised distinct key for a waste stream for cross-project deduplication.
 * Prefer waste_stream_type_id if present; else use lower(trim(name)).
 * Our inputs JSON uses category/name only (no type_id), so we use lower(trim(name)).
 */
export function streamDistinctKey(stream: unknown): string | null {
  if (stream == null) return null;
  const s = String(stream).trim();
  if (!s) return null;
  return s.toLowerCase();
}

/**
 * Aggregate distinct metrics from latest inputs per project.
 * - Total Waste Streams: count of UNIQUE stream types across all projects (e.g. Metal once even if multiple sites have it).
 * - Facilities utilised: count of UNIQUE facility_id across all projects (same facility only counted once).
 */
export function aggregateDistinctMetrics(
  latestInputsRows: LatestInputsRow[]
): { totalWasteStreamsConfigured: number; facilitiesLinked: number } {
  const streamKeys = new Set<string>();
  const facilityIds = new Set<string>();

  for (const { inputs } of latestInputsRows) {
    const wasteStreams = (inputs?.waste_streams as unknown[] | undefined) ?? [];
    for (const stream of wasteStreams) {
      const key = streamDistinctKey(stream);
      if (key != null) streamKeys.add(key);
    }

    const plans = (inputs?.waste_stream_plans as Array<{ facility_id?: string | null }> | undefined) ?? [];
    for (const p of plans) {
      const fid =
        p?.facility_id != null && String(p.facility_id).trim() !== ""
          ? String(p.facility_id).trim()
          : null;
      if (fid != null) facilityIds.add(fid);
    }
  }

  return {
    totalWasteStreamsConfigured: streamKeys.size,
    facilitiesLinked: facilityIds.size,
  };
}

/**
 * Whether a project is "ready for forecasting" based on project and latest inputs.
 * Rule: primary contractor set, at least one waste stream, and every waste_stream_plan
 * has both partner_id and facility_id set.
 */
export function computeIsForecastReady(
  project: { primary_waste_contractor_partner_id?: string | null },
  latestInputs: {
    waste_streams?: unknown[];
    waste_stream_plans?: Array<{ partner_id?: string | null; facility_id?: string | null }>;
  } | null
): boolean {
  if (!latestInputs) return false;
  if (!project.primary_waste_contractor_partner_id) return false;
  const streams = latestInputs.waste_streams ?? [];
  if (streams.length === 0) return false;
  const plans = latestInputs.waste_stream_plans ?? [];
  const allPlansHavePartnerAndFacility = plans.every(
    (p) =>
      p.partner_id != null &&
      String(p.partner_id).trim() !== "" &&
      p.facility_id != null &&
      String(p.facility_id).trim() !== ""
  );
  return allPlansHavePartnerAndFacility;
}
