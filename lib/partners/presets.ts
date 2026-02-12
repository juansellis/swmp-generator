/**
 * NZ-first partner (company) presets for SWMP destination modelling.
 * Partners are company-level; facilities (sites) reference partner_id.
 */

import type { Partner } from "./types";

export type { Partner };

export const NZ_PARTNER_PRESETS: Partner[] = [
  { id: "partner-akl-metals", name: "Local metals recycler (Auckland)", regions: ["Auckland"], partner_type: "Recycler" },
  { id: "partner-akl-cd", name: "C&D transfer station (Auckland)", regions: ["Auckland"], partner_type: "Transfer station" },
  { id: "partner-akl-green", name: "Green waste processor (Auckland)", regions: ["Auckland"], partner_type: "Processor" },
  { id: "partner-akl-cleanfill", name: "Cleanfill / spoil (Auckland)", regions: ["Auckland"], partner_type: "Cleanfill" },
  { id: "partner-akl-ewaste", name: "E-waste recycler (Auckland)", regions: ["Auckland"], partner_type: "Recycler" },
  { id: "partner-akl-cardboard", name: "Cardboard / packaging (Auckland)", regions: ["Auckland"], partner_type: "Recycler" },
  { id: "partner-wkt-metals", name: "Local metals recycler (Waikato)", regions: ["Waikato"], partner_type: "Recycler" },
  { id: "partner-wkt-cd", name: "C&D transfer station (Waikato)", regions: ["Waikato"], partner_type: "Transfer station" },
  { id: "partner-wkt-green", name: "Green waste processor (Waikato)", regions: ["Waikato"], partner_type: "Processor" },
  { id: "partner-wkt-cleanfill", name: "Cleanfill / spoil (Waikato)", regions: ["Waikato"], partner_type: "Cleanfill" },
  { id: "partner-wlg-metals", name: "Local metals recycler (Wellington)", regions: ["Wellington"], partner_type: "Recycler" },
  { id: "partner-wlg-cd", name: "C&D transfer station (Wellington)", regions: ["Wellington"], partner_type: "Transfer station" },
  { id: "partner-wlg-green", name: "Green waste processor (Wellington)", regions: ["Wellington"], partner_type: "Processor" },
  { id: "partner-wlg-cleanfill", name: "Cleanfill / spoil (Wellington)", regions: ["Wellington"], partner_type: "Cleanfill" },
  { id: "partner-wlg-gib", name: "Plasterboard / GIB recycler (Wellington)", regions: ["Wellington"], partner_type: "Recycler" },
  { id: "partner-can-metals", name: "Local metals recycler (Canterbury)", regions: ["Canterbury"], partner_type: "Recycler" },
  { id: "partner-can-cd", name: "C&D transfer station (Canterbury)", regions: ["Canterbury"], partner_type: "Transfer station" },
  { id: "partner-can-green", name: "Green waste processor (Canterbury)", regions: ["Canterbury"], partner_type: "Processor" },
  { id: "partner-can-cleanfill", name: "Cleanfill / spoil (Canterbury)", regions: ["Canterbury"], partner_type: "Cleanfill" },
];

export function getPartnerById(id: string | null | undefined): Partner | null {
  if (!id || typeof id !== "string") return null;
  return NZ_PARTNER_PRESETS.find((p) => p.id === id) ?? null;
}
