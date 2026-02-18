import type { TemplatePack } from "./types";
import { commercialFitout } from "./commercialFitout";
import { residentialBuild } from "./residentialBuild";
import { demolition } from "./demolition";

const PACKS: TemplatePack[] = [commercialFitout, residentialBuild, demolition];

/** Project type → template pack id (or key). Must match option values from PROJECT_TYPE_OPTIONS. */
const PROJECT_TYPE_TO_PACK: Record<string, string> = {
  "Commercial fit-out": commercialFitout.id,
  "Office fit-out": commercialFitout.id,
  "Retail fit-out": commercialFitout.id,
  "Hospitality fit-out": commercialFitout.id,
  "Commercial renovation": commercialFitout.id,
  "New build house": residentialBuild.id,
  "Townhouse / multi-unit (residential)": residentialBuild.id,
  "Residential renovation": residentialBuild.id,
  "Residential fit-out": residentialBuild.id,
  "Demolition / strip-out (commercial)": demolition.id,
};

/**
 * Returns the template pack for the given project type, or null if none.
 */
export function getTemplatePack(projectType: string): TemplatePack | null {
  const trimmed = (projectType ?? "").trim();
  if (!trimmed) return null;
  const packId = PROJECT_TYPE_TO_PACK[trimmed];
  if (!packId) return null;
  return PACKS.find((p) => p.id === packId) ?? null;
}

export { applyTemplateDefaults } from "./applyTemplateDefaults";
export type { TemplatePack, TemplateWasteStreamDefaults } from "./types";
export { commercialFitout, residentialBuild, demolition };
