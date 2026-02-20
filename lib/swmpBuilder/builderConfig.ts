/**
 * Guided SWMP Builder: step definitions and section mapping.
 * Single left rail "Plan Builder" — order matches Inputs page flow (source of truth).
 * 1. Project details, 2. Facilities & logistics, 3. Site constraints, 4. Waste streams,
 * 5. Resource inputs, 6. Monitoring & site controls, 7. Review & generate.
 */

export const BUILDER_STEPS = [
  { id: "basics", label: "Project details" },
  { id: "facilities", label: "Facilities & logistics" },
  { id: "siteConstraints", label: "Site constraints" },
  { id: "streams", label: "Waste streams" },
  { id: "resourceInputs", label: "Resource inputs" },
  { id: "monitoring", label: "Monitoring & site controls" },
  { id: "review", label: "Review & generate" },
] as const;

export type BuilderStepId = (typeof BUILDER_STEPS)[number]["id"];

/** Section id to scroll to when user clicks a step (must match section id in DOM). */
export const STEP_SECTION_IDS: Record<BuilderStepId, string> = {
  basics: "project-overview",
  facilities: "primary-waste-contractor",
  siteConstraints: "site-and-facilities",
  streams: "waste-streams",
  resourceInputs: "resource-inputs",
  monitoring: "monitoring-site-controls",
  review: "compliance-notes",
};
