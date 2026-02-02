/**
 * NZ-first facility/processor library as code-based presets.
 * accepted_streams must match exact stream labels used in the app.
 * Each facility belongs to a partner (company) via partner_id.
 */

import type { Facility } from "./types";

export type { Facility };

export const NZ_FACILITY_PRESETS: Facility[] = [
  // Auckland
  { id: "akl-metals-1", name: "Local metals recycler (Auckland)", type: "Recycler", partner_id: "partner-akl-metals", accepted_streams: ["Metals"], region: "Auckland" },
  { id: "akl-cd-1", name: "C&D transfer station (Auckland)", type: "Transfer station", partner_id: "partner-akl-cd", accepted_streams: ["Mixed C&D", "Concrete / masonry", "Concrete (reinforced)", "Concrete (unreinforced)", "Masonry / bricks", "Timber (untreated)", "Timber (treated)", "Plasterboard / GIB", "Metals", "Cardboard", "Roofing materials", "Asphalt / roading material"], region: "Auckland" },
  { id: "akl-green-1", name: "Green waste processor (Auckland)", type: "Processor", partner_id: "partner-akl-green", accepted_streams: ["Green waste / vegetation"], region: "Auckland" },
  { id: "akl-cleanfill-1", name: "Cleanfill / spoil (Auckland)", type: "Cleanfill", partner_id: "partner-akl-cleanfill", accepted_streams: ["Soil / spoil (cleanfill if verified)", "Cleanfill soil"], region: "Auckland" },
  { id: "akl-ewaste-1", name: "E-waste recycler (Auckland)", type: "Recycler", partner_id: "partner-akl-ewaste", accepted_streams: ["E-waste (cables/lighting/appliances)"], region: "Auckland" },
  { id: "akl-cardboard-1", name: "Cardboard / packaging (Auckland)", type: "Recycler", partner_id: "partner-akl-cardboard", accepted_streams: ["Cardboard", "Packaging (mixed)"], region: "Auckland" },
  // Waikato
  { id: "wkt-metals-1", name: "Local metals recycler (Waikato)", type: "Recycler", partner_id: "partner-wkt-metals", accepted_streams: ["Metals"], region: "Waikato" },
  { id: "wkt-cd-1", name: "C&D transfer station (Waikato)", type: "Transfer station", partner_id: "partner-wkt-cd", accepted_streams: ["Mixed C&D", "Concrete / masonry", "Concrete (reinforced)", "Concrete (unreinforced)", "Masonry / bricks", "Timber (untreated)", "Timber (treated)", "Plasterboard / GIB", "Metals", "Cardboard", "Roofing materials", "Asphalt / roading material"], region: "Waikato" },
  { id: "wkt-green-1", name: "Green waste processor (Waikato)", type: "Processor", partner_id: "partner-wkt-green", accepted_streams: ["Green waste / vegetation"], region: "Waikato" },
  { id: "wkt-cleanfill-1", name: "Cleanfill / spoil (Waikato)", type: "Cleanfill", partner_id: "partner-wkt-cleanfill", accepted_streams: ["Soil / spoil (cleanfill if verified)", "Cleanfill soil"], region: "Waikato" },
  // Wellington
  { id: "wlg-metals-1", name: "Local metals recycler (Wellington)", type: "Recycler", partner_id: "partner-wlg-metals", accepted_streams: ["Metals"], region: "Wellington" },
  { id: "wlg-cd-1", name: "C&D transfer station (Wellington)", type: "Transfer station", partner_id: "partner-wlg-cd", accepted_streams: ["Mixed C&D", "Concrete / masonry", "Concrete (reinforced)", "Concrete (unreinforced)", "Masonry / bricks", "Timber (untreated)", "Timber (treated)", "Plasterboard / GIB", "Metals", "Cardboard", "Roofing materials", "Asphalt / roading material"], region: "Wellington" },
  { id: "wlg-green-1", name: "Green waste processor (Wellington)", type: "Processor", partner_id: "partner-wlg-green", accepted_streams: ["Green waste / vegetation"], region: "Wellington" },
  { id: "wlg-cleanfill-1", name: "Cleanfill / spoil (Wellington)", type: "Cleanfill", partner_id: "partner-wlg-cleanfill", accepted_streams: ["Soil / spoil (cleanfill if verified)", "Cleanfill soil"], region: "Wellington" },
  { id: "wlg-gib-1", name: "Plasterboard / GIB recycler (Wellington)", type: "Recycler", partner_id: "partner-wlg-gib", accepted_streams: ["Plasterboard / GIB"], region: "Wellington" },
  // Canterbury
  { id: "can-metals-1", name: "Local metals recycler (Canterbury)", type: "Recycler", partner_id: "partner-can-metals", accepted_streams: ["Metals"], region: "Canterbury" },
  { id: "can-cd-1", name: "C&D transfer station (Canterbury)", type: "Transfer station", partner_id: "partner-can-cd", accepted_streams: ["Mixed C&D", "Concrete / masonry", "Concrete (reinforced)", "Concrete (unreinforced)", "Masonry / bricks", "Timber (untreated)", "Timber (treated)", "Plasterboard / GIB", "Metals", "Cardboard", "Roofing materials", "Asphalt / roading material"], region: "Canterbury" },
  { id: "can-green-1", name: "Green waste processor (Canterbury)", type: "Processor", partner_id: "partner-can-green", accepted_streams: ["Green waste / vegetation"], region: "Canterbury" },
  { id: "can-cleanfill-1", name: "Cleanfill / spoil (Canterbury)", type: "Cleanfill", partner_id: "partner-can-cleanfill", accepted_streams: ["Soil / spoil (cleanfill if verified)", "Cleanfill soil"], region: "Canterbury" },
];

/**
 * Returns all facilities (for admin/list use). Filter by region/stream via getFacilitiesForRegion / getFacilitiesByPartnerAndStream.
 */
export function getAllFacilities(): Facility[] {
  return NZ_FACILITY_PRESETS;
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

/**
 * Returns facilities that accept the given stream in the given region.
 * Stream label must match exactly (case-sensitive).
 */
export function getFacilitiesForStream(region: string, streamLabel: string): Facility[] {
  const byRegion = getFacilitiesForRegion(region);
  if (!streamLabel || typeof streamLabel !== "string") return byRegion;
  return byRegion.filter((f) => f.accepted_streams.includes(streamLabel));
}

/**
 * Returns facilities for a partner in a region that accept the given stream.
 */
export function getFacilitiesByPartnerAndStream(partnerId: string | null | undefined, region: string, streamLabel: string): Facility[] {
  const byStream = getFacilitiesForStream(region, streamLabel);
  if (!partnerId || typeof partnerId !== "string") return byStream;
  return byStream.filter((f) => f.partner_id === partnerId);
}

export function getFacilityById(id: string | null | undefined): Facility | null {
  if (!id || typeof id !== "string") return null;
  return NZ_FACILITY_PRESETS.find((f) => f.id === id) ?? null;
}
