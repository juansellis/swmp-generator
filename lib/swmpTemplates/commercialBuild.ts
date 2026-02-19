import type { TemplatePack } from "./types";

export const commercialBuild: TemplatePack = {
  id: "commercial-build",
  displayLabel: "Commercial Build",
  wasteStreamDefaults: {
    "Mixed C&D": {
      planned_pathway:
        "Segregate mixed C&D where practical. Send recyclables to approved processors; residual to permitted facility.",
      generation: "General construction, fit-out, and packaging waste from commercial build.",
      onsite_management: "Dedicated bins for mixed and key streams; separate timber, plasterboard, and metals where space allows.",
    },
    "Timber (untreated)": {
      planned_pathway: "Segregate untreated timber for reuse or recycling.",
      generation: "Formwork, framing offcuts, and packaging from construction.",
      onsite_management: "Designated area or bin; keep dry to maximise recovery.",
    },
    "Timber (treated)": {
      planned_pathway: "Segregate treated timber and send to approved recovery or disposal. Do not mix with clean fill.",
      generation: "Structural and external timber offcuts from build.",
      onsite_management: "Separate from untreated timber; dedicated container or area.",
    },
    "Plasterboard / GIB": {
      planned_pathway: "Segregate plasterboard and send to gypsum recycler. Keep dry to maximise recovery.",
      generation: "Linings, partitions, and offcuts from commercial build.",
      onsite_management: "Designated skip or area; protect from moisture.",
    },
    "Metals": {
      planned_pathway: "Segregate metals and send to scrap metal recycler.",
      generation: "Structural steel, services, fixings, and packaging.",
      onsite_management: "Dedicated container or area for metals.",
    },
    "Cardboard": {
      planned_pathway: "Flatten and segregate cardboard for recycling.",
      generation: "Packaging from materials and fit-out deliveries.",
      onsite_management: "Cardboard-only bin or bundling area.",
    },
    "Soft plastics (wrap/strapping)": {
      planned_pathway: "Segregate soft plastics for recycling where accepted by local processors.",
      generation: "Wrap, strapping, and packaging from deliveries.",
      onsite_management: "Designated bin or bag; keep clean and separate from mixed waste.",
    },
    "Hard plastics": {
      planned_pathway: "Segregate hard plastics for recycling where accepted.",
      generation: "Packaging, conduit, and construction plastics.",
      onsite_management: "Dedicated bin where practical; separate from mixed C&D.",
    },
    "Insulation": {
      planned_pathway: "Segregate insulation for recycling where accepted by local processors.",
      generation: "Ceiling and wall insulation offcuts from build.",
      onsite_management: "Keep dry and separate from general waste; avoid contamination.",
    },
    "Concrete / masonry": {
      planned_pathway: "Segregate concrete and masonry for crushing/recycling or approved disposal.",
      generation: "Slab offcuts, blockwork, and masonry from construction.",
      onsite_management: "Designated skip or stockpile; keep separate from soil and mixed.",
    },
    "Carpet / carpet tiles": {
      planned_pathway: "Separate carpet and tiles for reuse or recycling where accepted by local processors.",
      generation: "Offcuts and surplus from flooring installation.",
      onsite_management: "Stack or roll for collection; avoid contamination.",
    },
    "E-waste (cables/lighting/appliances)": {
      planned_pathway: "Segregate e-waste and send to approved e-waste recycler.",
      generation: "Cables, lighting, and appliances from fit-out and services.",
      onsite_management: "Dedicated container; do not mix with general waste.",
    },
    "Glass": {
      planned_pathway: "Segregate glass for recycling where practical.",
      generation: "Glazing offcuts and packaging from commercial build.",
      onsite_management: "Designated bin or crate; handle safely.",
    },
    "*": {
      planned_pathway: "Segregate where practical and send to an approved recycler/processor.",
      generation: "Construction and packaging waste from commercial build.",
      onsite_management: "Dedicated bins where practical; separate key streams.",
    },
  },
  monitoringDefaults: {
    methods: ["Dockets", "Invoices/receipts"],
    dockets_description:
      "All waste movements will be supported by weighbridge dockets and/or disposal receipts. Records will be retained for SWMP reporting and diversion tracking.",
  },
  siteControlsDefaults: {
    bin_setup:
      "Bins and skips will be positioned to suit build sequence and site access. Key streams (timber, plasterboard, metals, cardboard) will have dedicated containers where practical.",
    signage_storage:
      "Clear signage at bin locations. Waste stored to prevent wind-blown litter and weather damage.",
    contamination_controls:
      "Regular checks to prevent cross-contamination. Plasterboard and clean fill kept separate from mixed and wet waste.",
    hazardous_controls:
      "Hazardous materials will be separated, contained, and removed by approved operators with appropriate documentation.",
  },
  responsibilitiesDefaults: [
    { role: "SWMP Owner", party: "SWMP Owner", responsibilities: ["Maintain SWMP", "Coordinate waste and reporting with main contractor", "Drive diversion improvements"] },
    { role: "Main Contractor / Site Manager", party: "Main Contractor", responsibilities: ["Ensure segregation on site", "Manage bin placement and collection", "Coordinate with subcontractors"] },
    { role: "All trades", party: "Subcontractors", responsibilities: ["Follow segregation rules", "Use correct bins for plasterboard, metals, cardboard", "Report contamination promptly"] },
  ],
  notesDefaults:
    "Commercial build: prioritise segregation of timber, plasterboard, metals, and cardboard. Align bin placement with build programme and site access.",
};
