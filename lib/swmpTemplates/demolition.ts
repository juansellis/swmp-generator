import type { TemplatePack } from "./types";

export const demolition: TemplatePack = {
  id: "demolition",
  displayLabel: "Demolition / strip-out",
  wasteStreamDefaults: {
    "Mixed C&D": {
      planned_pathway:
        "Segregate where practical. Concrete, metals, and timber to dedicated streams; residual to permitted facility.",
      generation: "General demolition and strip-out waste.",
      onsite_management: "Dedicated bins by stream; maximise separation at source.",
    },
    "Concrete / masonry": {
      planned_pathway: "Crush on site or send to aggregate recycler where viable.",
      generation: "Demolition of slabs, foundations, and masonry.",
      onsite_management: "Separate from other streams; protect from contamination.",
    },
    "Metals": {
      planned_pathway: "Segregate all metals and send to scrap metal recycler.",
      generation: "Structural steel, reinforcement, services, and fixtures.",
      onsite_management: "Dedicated container or area; separate ferrous/non-ferrous if required.",
    },
    "Timber (untreated)": {
      planned_pathway: "Segregate for reuse or recycling where accepted.",
      generation: "Demolition timber and formwork.",
      onsite_management: "Keep separate from treated timber and mixed waste.",
    },
    "Timber (treated)": {
      planned_pathway: "Segregate and send to approved recovery or disposal.",
      generation: "Treated timber from structure and cladding.",
      onsite_management: "Do not mix with untreated or clean fill.",
    },
    "Plasterboard / GIB": {
      planned_pathway: "Segregate plasterboard and send to gypsum recycler. Keep dry.",
      generation: "Linings and partitions from strip-out.",
      onsite_management: "Designated skip; protect from moisture.",
    },
    "Glass": {
      planned_pathway: "Segregate glass for recycling where accepted.",
      generation: "Windows and glazing from strip-out.",
      onsite_management: "Dedicated container; handle with care.",
    },
  },
  monitoringDefaults: {
    methods: ["Dockets", "Invoices/receipts", "Photos"],
    dockets_description:
      "All demolition waste movements will be supported by weighbridge dockets and/or disposal receipts. Records retained for SWMP reporting and diversion verification.",
  },
  siteControlsDefaults: {
    bin_setup:
      "Bins and skips positioned to suit demolition sequence and truck access. Dedicated containers for concrete, metals, timber, and plasterboard.",
    contamination_controls:
      "Regular checks to prevent cross-contamination. Hazardous materials (e.g. asbestos) managed under separate plan.",
    hazardous_controls:
      "Hazardous materials will be identified, separated, and removed by licensed operators with appropriate documentation. No hazardous waste in general bins.",
  },
  responsibilitiesDefaults: [
    { role: "SWMP Owner", party: "SWMP Owner", responsibilities: ["Maintain SWMP", "Coordinate waste and demolition programme", "Verify diversion and hazardous removal records"] },
    { role: "Demolition / Site Manager", party: "Main Contractor", responsibilities: ["Ensure segregation by stream", "Manage hazardous identification and removal", "Coordinate truck access and bin placement"] },
    { role: "All trades", party: "Subcontractors", responsibilities: ["Follow segregation rules", "No hazardous in general bins", "Report issues promptly"] },
  ],
  notesDefaults:
    "Demolition/strip-out: prioritise concrete, metals, and timber segregation. Ensure hazardous materials are identified and managed separately.",
};
