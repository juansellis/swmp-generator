/**
 * Single-origin to single-destination driving distance/duration.
 * Uses Google Distance Matrix API (server-side only; GOOGLE_MAPS_API_KEY).
 */

import { getDistanceMatrix } from "./googleMaps";

export type DistanceResult = {
  distance_m: number;
  duration_s: number;
};

/**
 * Get driving distance and duration from origin to a single destination.
 * Returns null if key missing, API error, or no result.
 */
export async function getDistance(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): Promise<DistanceResult | null> {
  const results = await getDistanceMatrix(origin, [
    { facilityId: "dest", lat: dest.lat, lng: dest.lng },
  ]);
  const row = results[0];
  if (!row) return null;
  return { distance_m: row.distance_m, duration_s: row.duration_s };
}
