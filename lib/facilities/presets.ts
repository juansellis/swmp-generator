/**
 * NZ-first facility/processor library as code-based presets.
 * accepted_streams must match exact stream labels used in the app.
 * Each facility belongs to a partner (company) via partner_id.
 */

import type { Facility } from "./types";

export type { Facility };

export const NZ_FACILITY_PRESETS: Facility[] = [
  // Auckland
  { id: "akl-metals-1", name: "Local metals recycler (Auckland)", facility_type: "Recycler", partner_id: "partner-akl-metals", accepted_streams: ["Metals"], region: "Auckland" },
  { id: "akl-cd-1", name: "C&D transfer station (Auckland)", facility_type: "Transfer station", partner_id: "partner-akl-cd", accepted_streams: ["Mixed C&D", "Concrete / masonry", "Concrete (reinforced)", "Concrete (unreinforced)", "Masonry / bricks", "Timber (untreated)", "Timber (treated)", "Plasterboard / GIB", "Metals", "Cardboard", "Roofing materials", "Asphalt / roading material"], region: "Auckland" },
  { id: "akl-green-1", name: "Green waste processor (Auckland)", facility_type: "Processor", partner_id: "partner-akl-green", accepted_streams: ["Green waste / vegetation"], region: "Auckland" },
  { id: "akl-cleanfill-1", name: "Cleanfill / spoil (Auckland)", facility_type: "Cleanfill", partner_id: "partner-akl-cleanfill", accepted_streams: ["Soil / spoil (cleanfill if verified)", "Cleanfill soil"], region: "Auckland" },
  { id: "akl-ewaste-1", name: "E-waste recycler (Auckland)", facility_type: "Recycler", partner_id: "partner-akl-ewaste", accepted_streams: ["E-waste (cables/lighting/appliances)"], region: "Auckland" },
  { id: "akl-cardboard-1", name: "Cardboard / packaging (Auckland)", facility_type: "Recycler", partner_id: "partner-akl-cardboard", accepted_streams: ["Cardboard", "Packaging (mixed)"], region: "Auckland" },
  // Waikato
  { id: "wkt-metals-1", name: "Local metals recycler (Waikato)", facility_type: "Recycler", partner_id: "partner-wkt-metals", accepted_streams: ["Metals"], region: "Waikato" },
  { id: "wkt-cd-1", name: "C&D transfer station (Waikato)", facility_type: "Transfer station", partner_id: "partner-wkt-cd", accepted_streams: ["Mixed C&D", "Concrete / masonry", "Concrete (reinforced)", "Concrete (unreinforced)", "Masonry / bricks", "Timber (untreated)", "Timber (treated)", "Plasterboard / GIB", "Metals", "Cardboard", "Roofing materials", "Asphalt / roading material"], region: "Waikato" },
  { id: "wkt-green-1", name: "Green waste processor (Waikato)", facility_type: "Processor", partner_id: "partner-wkt-green", accepted_streams: ["Green waste / vegetation"], region: "Waikato" },
  { id: "wkt-cleanfill-1", name: "Cleanfill / spoil (Waikato)", facility_type: "Cleanfill", partner_id: "partner-wkt-cleanfill", accepted_streams: ["Soil / spoil (cleanfill if verified)", "Cleanfill soil"], region: "Waikato" },
  // Wellington
  { id: "wlg-metals-1", name: "Local metals recycler (Wellington)", facility_type: "Recycler", partner_id: "partner-wlg-metals", accepted_streams: ["Metals"], region: "Wellington" },
  { id: "wlg-cd-1", name: "C&D transfer station (Wellington)", facility_type: "Transfer station", partner_id: "partner-wlg-cd", accepted_streams: ["Mixed C&D", "Concrete / masonry", "Concrete (reinforced)", "Concrete (unreinforced)", "Masonry / bricks", "Timber (untreated)", "Timber (treated)", "Plasterboard / GIB", "Metals", "Cardboard", "Roofing materials", "Asphalt / roading material"], region: "Wellington" },
  { id: "wlg-green-1", name: "Green waste processor (Wellington)", facility_type: "Processor", partner_id: "partner-wlg-green", accepted_streams: ["Green waste / vegetation"], region: "Wellington" },
  { id: "wlg-cleanfill-1", name: "Cleanfill / spoil (Wellington)", facility_type: "Cleanfill", partner_id: "partner-wlg-cleanfill", accepted_streams: ["Soil / spoil (cleanfill if verified)", "Cleanfill soil"], region: "Wellington" },
  { id: "wlg-gib-1", name: "Plasterboard / GIB recycler (Wellington)", facility_type: "Recycler", partner_id: "partner-wlg-gib", accepted_streams: ["Plasterboard / GIB"], region: "Wellington" },
  // Canterbury
  { id: "can-metals-1", name: "Local metals recycler (Canterbury)", facility_type: "Recycler", partner_id: "partner-can-metals", accepted_streams: ["Metals"], region: "Canterbury" },
  { id: "can-cd-1", name: "C&D transfer station (Canterbury)", facility_type: "Transfer station", partner_id: "partner-can-cd", accepted_streams: ["Mixed C&D", "Concrete / masonry", "Concrete (reinforced)", "Concrete (unreinforced)", "Masonry / bricks", "Timber (untreated)", "Timber (treated)", "Plasterboard / GIB", "Metals", "Cardboard", "Roofing materials", "Asphalt / roading material"], region: "Canterbury" },
  { id: "can-green-1", name: "Green waste processor (Canterbury)", facility_type: "Processor", partner_id: "partner-can-green", accepted_streams: ["Green waste / vegetation"], region: "Canterbury" },
  { id: "can-cleanfill-1", name: "Cleanfill / spoil (Canterbury)", facility_type: "Cleanfill", partner_id: "partner-can-cleanfill", accepted_streams: ["Soil / spoil (cleanfill if verified)", "Cleanfill soil"], region: "Canterbury" },
];

/**
 * Returns all facilities (for admin/list use). Filter by region/stream via getFacilitiesForPartner / getFacilitiesForStream.
 */
export function getAllFacilities(): Facility[] {
  return NZ_FACILITY_PRESETS;
}

/**
 * Returns facilities for a partner, optionally filtered by region (case-insensitive).
 */
export function getFacilitiesForPartner(partnerId: string | null | undefined, region?: string | null): Facility[] {
  if (!partnerId || typeof partnerId !== "string") return [];
  let list = NZ_FACILITY_PRESETS.filter((f) => f.partner_id === partnerId);
  if (region != null && typeof region === "string" && region.trim()) {
    const r = region.trim().toLowerCase();
    list = list.filter((f) => f.region.toLowerCase() === r);
  }
  return list;
}

/**
 * Returns facilities that accept the given stream in the given region (case-insensitive region).
 * Stream label must match exactly (case-sensitive).
 */
function getFacilitiesForRegionAndStream(region: string, streamLabel: string): Facility[] {
  if (!region || typeof region !== "string") return [];
  const r = region.trim().toLowerCase();
  if (!r) return [];
  let list = NZ_FACILITY_PRESETS.filter((f) => f.region.toLowerCase() === r);
  if (streamLabel != null && typeof streamLabel === "string" && streamLabel.length > 0) {
    list = list.filter((f) => f.accepted_streams.includes(streamLabel));
  }
  return list;
}

/**
 * Returns facilities for a partner in a region that accept the given stream.
 */
export function getFacilitiesForStream(partnerId: string | null | undefined, region: string, streamLabel: string): Facility[] {
  const byRegionAndStream = getFacilitiesForRegionAndStream(region, streamLabel);
  if (!partnerId || typeof partnerId !== "string") return byRegionAndStream;
  return byRegionAndStream.filter((f) => f.partner_id === partnerId);
}

/**
 * Returns facilities for a region (case-insensitive match on region name).
 */
export function getFacilitiesForRegion(region: string): Facility[] {
  if (!region || typeof region !== "string") return [];
  const r = region.trim().toLowerCase();
  if (!r) return [];
  return NZ_FACILITY_PRESETS.filter((f) => f.region.toLowerCase() === r);
}

export function getFacilityById(id: string | null | undefined): Facility | null {
  if (!id || typeof id !== "string") return null;
  return NZ_FACILITY_PRESETS.find((f) => f.id === id) ?? null;
}
