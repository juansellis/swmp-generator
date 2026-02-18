/**
 * Apply template defaults to current SWMP inputs.
 * Pure function: only fills empty fields; never overwrites existing user content.
 */

import type { SwmpInputs, WasteStreamPlanInput, MonitoringInput, SiteControlsInput, ResponsibilityInput } from "@/lib/swmp/model";
import type { TemplatePack } from "./types";

function isEmptyString(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== "string") return true;
  return v.trim() === "";
}

function isEmptyArray(v: unknown): boolean {
  if (v == null) return true;
  if (!Array.isArray(v)) return true;
  return v.length === 0;
}

/**
 * Merges template defaults into currentInputs. Only injects into empty fields.
 * Does not mutate currentInputs; returns a new object.
 */
export function applyTemplateDefaults({
  template,
  currentInputs,
}: {
  template: TemplatePack;
  currentInputs: SwmpInputs;
}): SwmpInputs {
  const current = currentInputs;

  // Waste stream plans: apply per-stream defaults only where current value is empty
  const waste_stream_plans: WasteStreamPlanInput[] = (current.waste_stream_plans ?? []).map((plan) => {
    const defaults = template.wasteStreamDefaults?.[plan.category];
    if (!defaults) return { ...plan };

    const pathway =
      !isEmptyString(plan.pathway) ? plan.pathway : (defaults.planned_pathway ?? plan.pathway);
    const generated_by =
      !isEmptyString(plan.generated_by) ? plan.generated_by : (defaults.generation ?? plan.generated_by ?? null);
    const on_site_management =
      !isEmptyString(plan.on_site_management)
        ? plan.on_site_management
        : (defaults.onsite_management ?? plan.on_site_management ?? null);

    return { ...plan, pathway, generated_by, on_site_management };
  });

  // Monitoring: fill only empty fields
  const monCur = current.monitoring;
  const monDef = template.monitoringDefaults ?? {};
  const monitoring: MonitoringInput = {
    methods:
      Array.isArray(monCur?.methods) && monCur.methods.length > 0
        ? monCur.methods
        : (Array.isArray(monDef.methods) && monDef.methods.length > 0 ? monDef.methods : monCur?.methods ?? ["Dockets"]),
    uses_software: monCur?.uses_software ?? monDef.uses_software ?? false,
    software_name: monCur?.software_name != null && !isEmptyString(monCur.software_name) ? monCur.software_name : (monDef.software_name ?? monCur?.software_name ?? null),
    dockets_description: monCur?.dockets_description != null && !isEmptyString(monCur.dockets_description)
      ? monCur.dockets_description
      : (monDef.dockets_description ?? monCur?.dockets_description ?? ""),
  };

  // Site controls: fill only empty fields
  const siteCur = current.site_controls;
  const siteDef = template.siteControlsDefaults ?? {};
  const site_controls: SiteControlsInput = {
    bin_setup: siteCur?.bin_setup != null && !isEmptyString(siteCur.bin_setup) ? siteCur.bin_setup : (siteDef.bin_setup ?? siteCur?.bin_setup ?? ""),
    signage_storage: siteCur?.signage_storage != null && !isEmptyString(siteCur.signage_storage) ? siteCur.signage_storage : (siteDef.signage_storage ?? siteCur?.signage_storage ?? ""),
    contamination_controls: siteCur?.contamination_controls != null && !isEmptyString(siteCur.contamination_controls) ? siteCur.contamination_controls : (siteDef.contamination_controls ?? siteCur?.contamination_controls ?? ""),
    hazardous_controls: siteCur?.hazardous_controls != null && !isEmptyString(siteCur.hazardous_controls) ? siteCur.hazardous_controls : (siteDef.hazardous_controls ?? siteCur?.hazardous_controls ?? ""),
  };

  // Responsibilities: fill empty slots only (by index); pad with template if current has fewer rows
  const respCur = current.responsibilities ?? [];
  const respDef = template.responsibilitiesDefaults ?? [];
  const maxLen = Math.max(respCur.length, respDef.length);
  const responsibilities: ResponsibilityInput[] = Array.from({ length: maxLen }, (_, i) => {
    const r = respCur[i];
    const def = respDef[i];
    if (!r) {
      if (def) return { role: def.role, party: def.party, responsibilities: def.responsibilities ?? [] };
      return { role: "Role", party: "—", responsibilities: [] };
    }
    if (!def) return { ...r };
    const roleEmpty = isEmptyString(r.role);
    const partyEmpty = isEmptyString(r.party);
    const listEmpty = isEmptyArray(r.responsibilities) || (r.responsibilities?.every((x) => !String(x).trim()));
    if (!roleEmpty && !partyEmpty && !listEmpty) return { ...r };
    return {
      role: roleEmpty && def.role ? def.role : r.role,
      party: partyEmpty && def.party ? def.party : r.party,
      responsibilities:
        listEmpty && Array.isArray(def.responsibilities) && def.responsibilities.length > 0
          ? def.responsibilities
          : (r.responsibilities ?? []),
    };
  });

  // Notes: fill only if current is empty
  const notes =
    !isEmptyString(current.notes) ? current.notes : (template.notesDefaults ?? current.notes ?? null);

  return {
    ...current,
    waste_stream_plans,
    monitoring,
    site_controls,
    responsibilities,
    notes,
  };
}
