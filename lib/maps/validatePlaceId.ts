const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export type ValidatedPlace = {
  place_id: string;
  formatted_address: string;
  lat: number;
  lng: number;
};

export class MissingPlaceIdError extends Error {}
export class GooglePlacesError extends Error {
  status?: number;
  google_error?: string;
  constructor(message: string, status?: number, google_error?: string) {
    super(message);
    this.status = status;
    this.google_error = google_error;
  }
}

/**
 * Validate a place_id (from Places Autocomplete) via Geocoding API.
 * Geocoding API accepts the same place_ids as the JavaScript Autocomplete and only
 * requires "Geocoding API" to be enabled (no Places API (New) needed).
 */
export async function validatePlaceId(placeId: string): Promise<ValidatedPlace> {
  if (!placeId || !placeId.trim()) throw new MissingPlaceIdError("Missing place_id");

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new GooglePlacesError("Missing GOOGLE_MAPS_API_KEY");

  const trimmed = placeId.trim();
  const params = new URLSearchParams({
    place_id: trimmed,
    key,
  });

  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: Array<{
      place_id?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  };

  if (data.status !== "OK") {
    throw new GooglePlacesError(
      `Geocode failed: ${data.status} - ${data.error_message ?? ""}`,
      res.status,
      data.error_message ?? undefined
    );
  }

  const result = data.results?.[0];
  if (!result?.formatted_address || result.geometry?.location == null) {
    throw new GooglePlacesError("Geocode failed: no result or missing address/location", res.status);
  }

  const loc = result.geometry.location;
  const lat = loc.lat;
  const lng = loc.lng;
  if (lat == null || lng == null) {
    throw new GooglePlacesError("Geocode failed: missing lat/lng", res.status);
  }

  return {
    place_id: result.place_id ?? trimmed,
    formatted_address: result.formatted_address,
    lat: Number(lat),
    lng: Number(lng),
  };
}
