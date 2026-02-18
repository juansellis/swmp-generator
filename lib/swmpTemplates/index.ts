import type { TemplatePack } from "./types";
import { commercialFitout } from "./commercialFitout";
import { residentialBuild } from "./residentialBuild";
import { demolition } from "./demolition";
import { civilEarthworks } from "./civilEarthworks";
import { generic } from "./generic";

const PACKS: TemplatePack[] = [commercialFitout, residentialBuild, demolition, civilEarthworks, generic];

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
  "Civil works / earthworks": civilEarthworks.id,
  "Roading": civilEarthworks.id,
  "Three waters / underground services": civilEarthworks.id,
  "Landscaping": civilEarthworks.id,
};

/**
 * Returns the template pack for the given project type, or the generic pack if unknown.
 */
export function getTemplatePack(projectType: string): TemplatePack {
  const trimmed = (projectType ?? "").trim();
  if (!trimmed) return generic;
  const packId = PROJECT_TYPE_TO_PACK[trimmed];
  if (!packId) return generic;
  return PACKS.find((p) => p.id === packId) ?? generic;
}

export { applyTemplateDefaults } from "./applyTemplateDefaults";
export type { TemplatePack, TemplateWasteStreamDefaults } from "./types";
export { commercialFitout, residentialBuild, demolition, civilEarthworks, generic };
