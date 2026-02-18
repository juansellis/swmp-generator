import type { TemplatePack } from "./types";

export const residentialBuild: TemplatePack = {
  id: "residential-build",
  displayLabel: "Residential new build",
  wasteStreamDefaults: {
    "Mixed C&D": {
      planned_pathway:
        "Segregate mixed C&D where practical. Send recyclables to approved processors; residual to permitted facility.",
      generation: "General construction and packaging waste from build.",
      onsite_management: "Dedicated bins for mixed and key streams; separate timber and green waste where possible.",
    },
    "Timber (untreated)": {
      planned_pathway: "Segregate untreated timber for reuse or recycling.",
      generation: "Offcuts and formwork from construction.",
      onsite_management: "Designated area or bin; keep dry.",
    },
    "Timber (treated)": {
      planned_pathway: "Segregate treated timber and send to approved recovery or disposal.",
      generation: "Fencing, decking, and structural offcuts.",
      onsite_management: "Separate from untreated; do not mix with clean fill.",
    },
    "Soil / spoil (cleanfill if verified)": {
      planned_pathway: "Verify cleanfill status; send to approved cleanfill site where applicable.",
      generation: "Excavation and landscaping.",
      onsite_management: "Stockpile separately; avoid contamination.",
    },
    "Plasterboard / GIB": {
      planned_pathway: "Segregate plasterboard and send to gypsum recycler. Keep dry.",
      generation: "Linings and offcuts.",
      onsite_management: "Designated skip; protect from moisture.",
    },
    "Insulation": {
      planned_pathway: "Segregate insulation for recycling where accepted.",
      generation: "Ceiling and wall insulation offcuts.",
      onsite_management: "Keep dry and separate from general waste.",
    },
    "*": {
      planned_pathway: "Segregate where practical and send to an approved recycler/processor.",
      generation: "Construction and packaging waste from build.",
      onsite_management: "Dedicated bins where practical; keep key streams separate.",
    },
  },
  monitoringDefaults: {
    methods: ["Dockets", "Photos"],
    dockets_description:
      "Waste movements will be recorded with dockets or receipts. Records retained for SWMP and diversion reporting.",
  },
  siteControlsDefaults: {
    bin_setup:
      "Bins positioned to suit build sequence and site access. Key streams (timber, plasterboard, green waste) will have dedicated containers where space allows.",
    signage_storage:
      "Clear signage at bin locations. Waste stored to prevent wind-blown litter and weather damage.",
  },
  responsibilitiesDefaults: [
    { role: "SWMP Owner", party: "SWMP Owner", responsibilities: ["Maintain SWMP", "Coordinate waste and reporting", "Drive improvements"] },
    { role: "Main Contractor / Site Manager", party: "Main Contractor", responsibilities: ["Ensure segregation", "Manage contamination", "Coordinate subcontractors"] },
    { role: "All trades", party: "Subcontractors", responsibilities: ["Follow segregation rules", "Keep areas tidy", "Report issues promptly"] },
  ],
  notesDefaults:
    "Residential build: focus on timber, plasterboard, and soil/cleanfill segregation. Align bin placement with stage of build.",
};
