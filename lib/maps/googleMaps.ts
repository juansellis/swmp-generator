/**
 * Google Maps server-side integration (Geocoding + Distance Matrix).
 * Use GOOGLE_MAPS_API_KEY in env; never expose to client.
 */

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

/** Max destinations per Distance Matrix request (API limit). */
const MAX_DESTINATIONS_PER_REQUEST = 25;

function getApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return key && String(key).trim() !== "" ? String(key).trim() : null;
}

export type GeocodeResult = { lat: number; lng: number };

export type ValidatedAddressResult = {
  formatted_address: string;
  place_id: string;
  lat: number;
  lng: number;
};

/**
 * Resolve a Place ID to formatted address and lat/lng (server-side validation).
 * Uses Geocoding API with place_id component. Returns null if invalid or key missing.
 */
export async function geocodeByPlaceId(placeId: string): Promise<ValidatedAddressResult | null> {
  const key = getApiKey();
  if (!key) return null;

  const trimmed = (placeId ?? "").trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    components: `place_id:${trimmed}`,
    key,
  });

  try {
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        place_id?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) return null;
    const first = data.results[0];
    const loc = first?.geometry?.location;
    const formatted = first?.formatted_address ?? "";
    const pid = first?.place_id ?? trimmed;
    if (loc?.lat == null || loc?.lng == null || !formatted) return null;
    return {
      formatted_address: formatted,
      place_id: pid,
      lat: Number(loc.lat),
      lng: Number(loc.lng),
    };
  } catch {
    return null;
  }
}

/**
 * Geocode an address to lat/lng using Google Geocoding API.
 * Returns null if key missing, request fails, or no results.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = getApiKey();
  if (!key) return null;

  const trimmed = (address ?? "").trim();
  if (!trimmed) return null;

  const params = new URLSearchParams({
    address: trimmed,
    key,
  });

  try {
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) return null;
    const loc = data.results[0]?.geometry?.location;
    if (loc?.lat == null || loc?.lng == null) return null;
    return { lat: Number(loc.lat), lng: Number(loc.lng) };
  } catch {
    return null;
  }
}

export type DistanceMatrixDestination = { facilityId: string; lat: number; lng: number };

export type DistanceMatrixResultItem = {
  facilityId: string;
  distance_m: number;
  duration_s: number;
};

/**
 * Get driving distance and duration from one origin to many destinations.
 * Uses Google Distance Matrix API; batches destinations in groups of 25.
 * Returns only successfully resolved rows; failed rows are omitted.
 */
export async function getDistanceMatrix(
  originLatLng: { lat: number; lng: number },
  destinations: DistanceMatrixDestination[]
): Promise<DistanceMatrixResultItem[]> {
  const key = getApiKey();
  if (!key || destinations.length === 0) return [];

  const originStr = `${originLatLng.lat},${originLatLng.lng}`;
  const results: DistanceMatrixResultItem[] = [];

  for (let i = 0; i < destinations.length; i += MAX_DESTINATIONS_PER_REQUEST) {
    const chunk = destinations.slice(i, i + MAX_DESTINATIONS_PER_REQUEST);
    const destStr = chunk.map((d) => `${d.lat},${d.lng}`).join("|");

    const params = new URLSearchParams({
      origins: originStr,
      destinations: destStr,
      mode: "driving",
      key,
    });

    try {
      const res = await fetch(`${DISTANCE_MATRIX_URL}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const data = (await res.json()) as {
        status?: string;
        rows?: Array<{
          elements?: Array<{
            status?: string;
            distance?: { value?: number };
            duration?: { value?: number };
          }>;
        }>;
      };

      if (data.status !== "OK" || !data.rows?.length) continue;

      const elements = data.rows[0]?.elements ?? [];
      for (let j = 0; j < elements.length && j < chunk.length; j++) {
        const el = elements[j];
        const dest = chunk[j];
        if (el?.status === "OK" && el.distance?.value != null && el.duration?.value != null) {
          results.push({
            facilityId: dest.facilityId,
            distance_m: Math.round(el.distance.value),
            duration_s: Math.round(el.duration.value),
          });
        }
      }
    } catch {
      // Skip this chunk on error
    }
  }

  return results;
}
