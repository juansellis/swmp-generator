/**
 * Shared project ↔ facility distance map.
 * Single source of truth for distance lookups used by Report (wasteStrategyBuilder) and Optimiser.
 * Keys are facility UUIDs; use normalizeFacilityId when reading/writing to avoid case or whitespace mismatch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DistanceEntry = {
  distance_km: number;
  duration_min: number;
  source: "cache";
};

/** Normalize facility id for consistent map lookup (UUIDs may differ by case from DB). */
export function normalizeFacilityId(id: string | null | undefined): string {
  const s = id != null ? String(id).trim() : "";
  return s.toLowerCase();
}

export type DistanceRow = {
  facility_id: string | null;
  distance_m: number;
  duration_s: number;
};

/**
 * Build distance map from pre-fetched project_facility_distances rows.
 * Keys are normalized facility_id for consistent lookup (avoids UUID case mismatch).
 */
export function buildDistanceMapFromRows(
  rows: DistanceRow[]
): Record<string, DistanceEntry> {
  const map: Record<string, DistanceEntry> = {};
  for (const row of rows ?? []) {
    const fid = row.facility_id;
    if (fid == null || fid === "") continue;
    const distance_m = row.distance_m;
    const duration_s = row.duration_s;
    if (typeof distance_m !== "number" || !Number.isFinite(distance_m)) continue;
    const key = normalizeFacilityId(fid);
    map[key] = {
      distance_km: Math.round((distance_m / 1000) * 100) / 100,
      duration_min: typeof duration_s === "number" && Number.isFinite(duration_s)
        ? Math.round((duration_s / 60) * 10) / 10
        : 0,
      source: "cache",
    };
  }
  return map;
}

/**
 * Fetch project_facility_distances for a project and return a map keyed by normalized facility_id.
 * Used by facility-optimiser API and can be used by wasteStrategyBuilder for consistent distance access.
 * Returns { [normalizedFacilityId]: { distance_km, duration_min, source: 'cache' } }.
 */
export async function getProjectFacilityDistanceMap(
  supabase: SupabaseClient,
  projectId: string
): Promise<Record<string, DistanceEntry>> {
  const { data: rows, error } = await supabase
    .from("project_facility_distances")
    .select("facility_id, distance_m, duration_s")
    .eq("project_id", projectId);

  if (error) return {};
  return buildDistanceMapFromRows((rows ?? []) as DistanceRow[]);
}

/**
 * Look up distance for a facility from the map. Use normalizeFacilityId(facilityId) for the key.
 */
export function getDistanceForFacility(
  map: Record<string, DistanceEntry>,
  facilityId: string | null | undefined
): DistanceEntry | null {
  if (facilityId == null || facilityId === "") return null;
  return map[normalizeFacilityId(facilityId)] ?? null;
}
