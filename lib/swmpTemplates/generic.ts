import type { TemplatePack } from "./types";

/** Fallback pack when project type is unknown or has no specific pack. */
export const generic: TemplatePack = {
  id: "generic",
  displayLabel: "Generic",
  wasteStreamDefaults: {
    "*": {
      planned_pathway: "Segregate where practical and send to an approved recycler/processor.",
      generation: "Construction and demolition waste from project activities.",
      onsite_management: "Dedicated bins by stream where practical; maximise separation at source.",
    },
  },
  monitoringDefaults: null,
  siteControlsDefaults: null,
  responsibilitiesDefaults: null,
  notesDefaults: null,
};
