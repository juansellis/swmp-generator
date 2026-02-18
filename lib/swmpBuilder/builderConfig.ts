/**
 * Guided SWMP Builder: step definitions and section mapping.
 * Single left rail "Plan Builder" with 6 steps in exact order.
 */

export const BUILDER_STEPS = [
  { id: "basics", label: "Project basics" },
  { id: "streams", label: "Waste streams" },
  { id: "facilities", label: "Facilities & logistics" },
  { id: "resourceInputs", label: "Resource inputs (optional)" },
  { id: "monitoring", label: "Monitoring & site controls" },
  { id: "review", label: "Review & generate" },
] as const;

export type BuilderStepId = (typeof BUILDER_STEPS)[number]["id"];

/** Section id to scroll to when user clicks a step (must match section id in DOM). */
export const STEP_SECTION_IDS: Record<BuilderStepId, string> = {
  basics: "project-overview",
  streams: "waste-streams",
  facilities: "primary-waste-contractor",
  resourceInputs: "resource-inputs",
  monitoring: "monitoring-site-controls",
  review: "compliance-notes",
};
