/**
 * Data access layer for facilities (sites).
 * UI and report use this module only; do not import presets directly.
 *
 * TODO: Replace preset source with Supabase table (e.g. facilities table with partner_id, region, accepted_streams).
 * When integrating: fetch from supabase.from("facilities").select("*"),
 * filter by region/partner_id/stream as needed, and keep getFacilityById as a lookup by id.
 */

import {
  getAllFacilities as getAllFacilitiesPreset,
  getFacilitiesForRegion as getFacilitiesForRegionPreset,
  getFacilitiesForStream as getFacilitiesForStreamPreset,
  getFacilitiesByPartnerAndStream as getFacilitiesByPartnerAndStreamPreset,
  getFacilityById as getFacilityByIdPreset,
} from "./presets";
import type { Facility } from "./types";

export type { Facility };

/**
 * Returns all facilities (for admin/list use). Currently presets only.
 * TODO: Supabase: return from supabase.from("facilities").select("*").order("region").order("name")
 */
export function getFacilities(): Facility[] {
  return getAllFacilitiesPreset();
}

/**
 * Returns facilities for a region (case-insensitive).
 * TODO: Supabase: .eq("region", region) or .ilike("region", region)
 */
export function getFacilitiesForRegion(region: string): Facility[] {
  return getFacilitiesForRegionPreset(region);
}

/**
 * Returns facilities that accept the given stream in the given region.
 * TODO: Supabase: filter by region + stream (e.g. accepted_streams array contains streamLabel)
 */
export function getFacilitiesForStream(region: string, streamLabel: string): Facility[] {
  return getFacilitiesForStreamPreset(region, streamLabel);
}

/**
 * Returns facilities for a partner in a region that accept the given stream.
 * TODO: Supabase: filter by partner_id, region, and accepted_streams
 */
export function getFacilitiesByPartnerAndStream(
  partnerId: string | null | undefined,
  region: string,
  streamLabel: string
): Facility[] {
  return getFacilitiesByPartnerAndStreamPreset(partnerId, region, streamLabel);
}

/**
 * Returns a facility by id, or null if not found.
 * TODO: Supabase: return from supabase.from("facilities").select("*").eq("id", id).single() or cache and look up.
 */
export function getFacilityById(id: string | null | undefined): Facility | null {
  return getFacilityByIdPreset(id);
}
