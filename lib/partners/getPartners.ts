/**
 * Data access layer for partners (companies).
 * UI and report use this module only; do not import presets directly.
 *
 * TODO: Replace preset source with Supabase table (e.g. partners table).
 * When integrating: fetch from supabase.from("partners").select("*"),
 * optionally filter by region/org, and keep getPartnerById as a lookup by id.
 */

import { NZ_PARTNER_PRESETS, getPartnerById as getPartnerByIdPreset } from "./presets";
import type { Partner } from "./types";

export type { Partner };

/**
 * Returns all partners. Use for Partner dropdown and lists.
 * TODO: Supabase: return from supabase.from("partners").select("*").order("name")
 */
export function getPartners(): Partner[] {
  return NZ_PARTNER_PRESETS;
}

/**
 * Returns a partner by id, or null if not found.
 * TODO: Supabase: return from supabase.from("partners").select("*").eq("id", id).single() or cache getPartners() and look up.
 */
export function getPartnerById(id: string | null | undefined): Partner | null {
  return getPartnerByIdPreset(id);
}
