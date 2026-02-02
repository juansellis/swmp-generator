/**
 * NZ-first partner (company) presets for SWMP destination modelling.
 * Partners are company-level; facilities (sites) reference partner_id.
 */

import type { Partner } from "./types";

export type { Partner };

export const NZ_PARTNER_PRESETS: Partner[] = [
  { id: "partner-akl-metals", name: "Local metals recycler (Auckland)" },
  { id: "partner-akl-cd", name: "C&D transfer station (Auckland)" },
  { id: "partner-akl-green", name: "Green waste processor (Auckland)" },
  { id: "partner-akl-cleanfill", name: "Cleanfill / spoil (Auckland)" },
  { id: "partner-akl-ewaste", name: "E-waste recycler (Auckland)" },
  { id: "partner-akl-cardboard", name: "Cardboard / packaging (Auckland)" },
  { id: "partner-wkt-metals", name: "Local metals recycler (Waikato)" },
  { id: "partner-wkt-cd", name: "C&D transfer station (Waikato)" },
  { id: "partner-wkt-green", name: "Green waste processor (Waikato)" },
  { id: "partner-wkt-cleanfill", name: "Cleanfill / spoil (Waikato)" },
  { id: "partner-wlg-metals", name: "Local metals recycler (Wellington)" },
  { id: "partner-wlg-cd", name: "C&D transfer station (Wellington)" },
  { id: "partner-wlg-green", name: "Green waste processor (Wellington)" },
  { id: "partner-wlg-cleanfill", name: "Cleanfill / spoil (Wellington)" },
  { id: "partner-wlg-gib", name: "Plasterboard / GIB recycler (Wellington)" },
  { id: "partner-can-metals", name: "Local metals recycler (Canterbury)" },
  { id: "partner-can-cd", name: "C&D transfer station (Canterbury)" },
  { id: "partner-can-green", name: "Green waste processor (Canterbury)" },
  { id: "partner-can-cleanfill", name: "Cleanfill / spoil (Canterbury)" },
];

export function getPartnerById(id: string | null | undefined): Partner | null {
  if (!id || typeof id !== "string") return null;
  return NZ_PARTNER_PRESETS.find((p) => p.id === id) ?? null;
}
