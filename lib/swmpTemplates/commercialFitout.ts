import type { TemplatePack } from "./types";

export const commercialFitout: TemplatePack = {
  id: "commercial-fitout",
  displayLabel: "Commercial fit-out",
  wasteStreamDefaults: {
    "Mixed C&D": {
      planned_pathway:
        "Segregate mixed C&D where practical. Send recyclables to approved processors; residual to permitted facility.",
      generation: "Fit-out strip-out, packaging, and general construction waste.",
      onsite_management: "Dedicated bins for mixed and key streams; separate cardboard and plastics where space allows.",
    },
    "Plasterboard / GIB": {
      planned_pathway: "Segregate plasterboard and send to gypsum recycler. Keep dry to maximise recovery.",
      generation: "Partition removal and offcuts.",
      onsite_management: "Designated skip or area; protect from moisture.",
    },
    "Carpet / carpet tiles": {
      planned_pathway: "Separate carpet and tiles for reuse or recycling where accepted by local processors.",
      generation: "Removal of existing flooring during strip-out.",
      onsite_management: "Stack or roll for collection; avoid contamination with other waste.",
    },
    "Metals": {
      planned_pathway: "Segregate metals and send to scrap metal recycler.",
      generation: "Services, fixtures, and fittings removal.",
      onsite_management: "Dedicated container or area for metals.",
    },
    "Cardboard": {
      planned_pathway: "Flatten and segregate cardboard for recycling.",
      generation: "Packaging from new materials and fit-out.",
      onsite_management: "Cardboard-only bin or bundling area.",
    },
  },
  monitoringDefaults: {
    methods: ["Dockets", "Invoices/receipts"],
    dockets_description:
      "All waste movements will be supported by weighbridge dockets and/or disposal receipts. Records will be retained for SWMP reporting and diversion tracking.",
  },
  siteControlsDefaults: {
    bin_setup:
      "Bins and skips will be positioned to suit fit-out sequence and access. Key streams (e.g. plasterboard, metals, cardboard) will have dedicated containers where practical.",
    contamination_controls:
      "Regular checks to prevent cross-contamination. Plasterboard and clean fill will be kept separate from mixed and wet waste.",
  },
  responsibilitiesDefaults: [
    { role: "SWMP Owner", party: "SWMP Owner", responsibilities: ["Maintain SWMP", "Coordinate waste and reporting with tenant and contractor", "Drive diversion improvements"] },
    { role: "Main Contractor / Site Manager", party: "Main Contractor", responsibilities: ["Ensure segregation on site", "Manage bin placement and collection timing", "Coordinate with fit-out trades"] },
    { role: "All trades", party: "Subcontractors", responsibilities: ["Follow segregation rules", "Use correct bins for plasterboard, metals, cardboard", "Report contamination promptly"] },
  ],
  notesDefaults:
    "Commercial fit-out: prioritise segregation of plasterboard, metals, and cardboard. Align with tenant and contractor programme for bin placement and collection.",
};
