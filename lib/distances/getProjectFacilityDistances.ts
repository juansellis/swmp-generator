/**
 * Single source of truth for project → facility distances.
 * Used by Optimiser and Report. Idempotent and safe to re-run.
 *
 * a) Tries to use persisted project_facility_distances.
 * b) If missing (or partial), computes via Google Distance Matrix.
 * c) Persists computed rows to project_facility_distances.
 * Returns a map keyed by normalized facility_id: { distance_km, duration_min }.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodeAddress, getDistanceMatrix } from "@/lib/maps/googleMaps";
import {
  buildDistanceMapFromRows,
  getDistanceForFacility,
  type DistanceEntry,
  type DistanceRow,
  normalizeFacilityId,
} from "@/lib/distance/getProjectFacilityDistanceMap";

export type GetProjectFacilityDistancesResult = {
  /** Map by normalized facility_id → distance_km, duration_min */
  distanceMap: Record<string, DistanceEntry>;
  /** Number of facilities with coords considered */
  facilitiesWithCoords: number;
  /** Number of facility ids present in the returned map */
  distancesLoaded: number;
  /** Facility ids that have coords but had no distance (e.g. API failed for that chunk) */
  missingFacilityIds: string[];
};

/**
 * Get project → facility distances: read from project_facility_distances, compute and persist any missing, return full map.
 * Ensures project has site_lat/site_lng (geocodes if address present). Only facilities with lat/lng are computed.
 */
export async function getProjectFacilityDistances(
  supabase: SupabaseClient,
  projectId: string
): Promise<GetProjectFacilityDistancesResult> {
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, site_lat, site_lng, site_address, address")
    .eq("id", projectId)
    .single();

  if (projectErr || !project) {
    return { distanceMap: {}, facilitiesWithCoords: 0, distancesLoaded: 0, missingFacilityIds: [] };
  }

  let siteLat = project.site_lat != null ? Number(project.site_lat) : null;
  let siteLng = project.site_lng != null ? Number(project.site_lng) : null;

  if (siteLat == null || siteLng == null || !Number.isFinite(siteLat) || !Number.isFinite(siteLng)) {
    const address = (project.site_address ?? project.address ?? "").trim();
    if (!address) {
      return { distanceMap: {}, facilitiesWithCoords: 0, distancesLoaded: 0, missingFacilityIds: [] };
    }
    const coords = await geocodeAddress(address);
    if (!coords) {
      return { distanceMap: {}, facilitiesWithCoords: 0, distancesLoaded: 0, missingFacilityIds: [] };
    }
    siteLat = coords.lat;
    siteLng = coords.lng;
    await supabase
      .from("projects")
      .update({
        site_lat: siteLat,
        site_lng: siteLng,
        ...(project.site_address == null ? { site_address: address } : {}),
      })
      .eq("id", projectId);
  }

  const [facilitiesRes, distancesRes] = await Promise.all([
    supabase.from("facilities").select("id, lat, lng"),
    supabase
      .from("project_facility_distances")
      .select("facility_id, distance_m, duration_s")
      .eq("project_id", projectId),
  ]);

  const facilities = (facilitiesRes.data ?? []) as { id: string; lat: number | null; lng: number | null }[];
  const existingRows = (distancesRes.data ?? []) as DistanceRow[];

  const withCoords: { id: string; lat: number; lng: number }[] = [];
  const existingByFacility = new Set(existingRows.map((r) => normalizeFacilityId(r.facility_id)));

  for (const f of facilities) {
    const lat = f.lat != null ? Number(f.lat) : null;
    const lng = f.lng != null ? Number(f.lng) : null;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      withCoords.push({ id: f.id, lat, lng });
    }
  }

  const toCompute = withCoords.filter((f) => !existingByFacility.has(normalizeFacilityId(f.id)));
  const newRows: DistanceRow[] = [...existingRows];

  if (toCompute.length > 0 && siteLat != null && siteLng != null) {
    const destinations = toCompute.map((f) => ({ facilityId: f.id, lat: f.lat, lng: f.lng }));
    const matrixResults = await getDistanceMatrix({ lat: siteLat, lng: siteLng }, destinations);
    const now = new Date().toISOString();
    for (const row of matrixResults) {
      newRows.push({
        facility_id: row.facilityId,
        distance_m: row.distance_m,
        duration_s: row.duration_s,
      });
      await supabase.from("project_facility_distances").upsert(
        {
          project_id: projectId,
          facility_id: row.facilityId,
          distance_m: row.distance_m,
          duration_s: row.duration_s,
          provider: "google",
          updated_at: now,
        },
        { onConflict: "project_id,facility_id" }
      );
    }
  }

  const distanceMap = buildDistanceMapFromRows(newRows);
  const distancesLoaded = Object.keys(distanceMap).length;
  const missingFacilityIds = withCoords
    .filter((f) => getDistanceForFacility(distanceMap, f.id) == null)
    .map((f) => f.id);

  return {
    distanceMap,
    facilitiesWithCoords: withCoords.length,
    distancesLoaded,
    missingFacilityIds,
  };
}
