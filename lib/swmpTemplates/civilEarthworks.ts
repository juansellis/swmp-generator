import type { TemplatePack } from "./types";

export const civilEarthworks: TemplatePack = {
  id: "civil-earthworks",
  displayLabel: "Civil works / earthworks",
  wasteStreamDefaults: {
    "Concrete / masonry": {
      planned_pathway: "Crush on site or send to aggregate recycler; surplus to approved disposal.",
      generation: "Breaking out of pavements, kerbs, and structures; surplus from pours.",
      onsite_management: "Separate from soil and other streams; stockpile or dedicated bin.",
    },
    "Soil / spoil (cleanfill if verified)": {
      planned_pathway: "Verify cleanfill status; send to approved cleanfill or rehabilitation site.",
      generation: "Excavation, trenching, and earthworks.",
      onsite_management: "Stockpile by type; avoid contamination; keep clean and contaminated separate.",
    },
    "Soft plastics (wrap/strapping)": {
      planned_pathway: "Segregate for recycling where accepted; otherwise to permitted facility.",
      generation: "Wrap and strapping from deliveries and materials.",
      onsite_management: "Dedicated bin or bundling area; keep dry.",
    },
    "Metals": {
      planned_pathway: "Segregate metals and send to scrap metal recycler.",
      generation: "Reinforcement, culverts, and services.",
      onsite_management: "Dedicated container or area; separate from soil and concrete.",
    },
    "*": {
      planned_pathway: "Segregate where practical and send to an approved recycler/processor.",
      generation: "Civil and earthworks waste.",
      onsite_management: "Dedicated bins by stream; minimise mixing with soil and spoil.",
    },
  },
  monitoringDefaults: {
    methods: ["Dockets", "Invoices/receipts", "Photos"],
    dockets_description:
      "All waste and spoil movements will be supported by weighbridge dockets and/or disposal receipts. Records retained for SWMP reporting and cleanfill verification.",
  },
  siteControlsDefaults: {
    bin_setup:
      "Bins and stockpile areas positioned for truck access and segregation. Separate areas for soil/spoil, concrete, and metals.",
    contamination_controls:
      "Regular checks to prevent cross-contamination. Clean and contaminated soil kept strictly separate.",
    hazardous_controls:
      "Contaminated soil and hazardous materials will be identified and managed under separate plan with appropriate documentation.",
  },
  responsibilitiesDefaults: [
    { role: "SWMP Owner", party: "SWMP Owner", responsibilities: ["Maintain SWMP", "Coordinate waste and spoil reporting", "Verify cleanfill and diversion records"] },
    { role: "Site / Earthworks Manager", party: "Main Contractor", responsibilities: ["Ensure segregation of soil, concrete, and metals", "Manage stockpiles and bin placement", "Coordinate with haulers"] },
    { role: "All trades", party: "Subcontractors", responsibilities: ["Follow segregation rules", "No contaminated material in cleanfill", "Report issues promptly"] },
  ],
  notesDefaults:
    "Civil/earthworks: prioritise soil and spoil segregation and cleanfill verification. Concrete and metals to dedicated streams.",
};
