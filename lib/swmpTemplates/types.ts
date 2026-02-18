/**
 * Template pack shape for SWMP smart templates.
 * Used to supply defaults by project type; applied only to empty fields.
 */

import type { MonitoringInput, SiteControlsInput } from "@/lib/swmp/model";

export type TemplateWasteStreamDefaults = Record<
  string,
  {
    planned_pathway?: string;
    generation?: string;
    onsite_management?: string;
  }
>;

export type TemplatePack = {
  id: string;
  /** Display name for UI (e.g. "Commercial fit-out", "Residential new build") */
  displayLabel: string;
  wasteStreamDefaults?: TemplateWasteStreamDefaults;
  monitoringDefaults?: Partial<MonitoringInput> | null;
  siteControlsDefaults?: Partial<SiteControlsInput> | null;
  responsibilitiesDefaults?: Array<{ role: string; party: string; responsibilities: string[] }> | null;
  notesDefaults?: string | null;
};
