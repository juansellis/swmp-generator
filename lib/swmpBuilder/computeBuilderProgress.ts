/**
 * Progress engine for the Guided SWMP Builder.
 * Returns completion status per step and which step is recommended next.
 * Resource inputs step is optional and never blocks progress.
 */

import { BUILDER_STEPS, type BuilderStepId } from "./builderConfig";

export type StepStatus = "complete" | "attention" | "not_started" | "recommendedNext";

export type BuilderStepProgress = {
  stepId: BuilderStepId;
  label: string;
  status: StepStatus;
};

/** Minimal input shape derived from project + SWMP inputs state. */
export type BuilderProgressInput = {
  /** Project name (project row name) */
  projectName?: string | null;
  /** Site address (validated or raw) */
  siteAddress?: string | null;
  /** Site address validated (place_id or geocode present) */
  siteAddressValidated?: boolean;
  /** Region */
  region?: string | null;
  /** Project type (effective) */
  projectType?: string | null;
  /** Start date set */
  startDate?: string | null;
  /** Number of selected waste streams */
  wasteStreamsCount?: number;
  /** At least one stream has planned tonnes > 0 */
  hasPlannedTonnes?: boolean;
  /** Every planned stream has facility or custom destination set (only meaningful when wasteStreamsCount > 0) */
  allStreamsHaveDestination?: boolean;
  /** Every planned stream has disposal method set (intended_outcomes length > 0) */
  allStreamsHaveDisposal?: boolean;
  /** At least one stream has facility/destination (legacy) */
  hasFacilityOrDestination?: boolean;
  /** Primary waste contractor (partner) selected */
  primaryWasteContractorPartnerId?: string | null;
  /** Site constraints (checkboxes) – at least one selected counts toward Facilities & logistics */
  constraints?: string[];
  /** Site controls: any text present (bin setup, signage, etc.) */
  siteControls?: {
    bin_setup?: string | null;
    signage_storage?: string | null;
    contamination_controls?: string | null;
    hazardous_controls?: string | null;
  } | null;
  /** Monitoring: cadence + methods or software */
  monitoring?: {
    methods?: string[];
    dockets_description?: string | null;
    reportingCadence?: string | null;
    uses_software?: boolean;
  } | null;
  /** Review: notes or responsibilities touched */
  hasNotesOrResponsibilities?: boolean;
};

function isEmptyString(s: string | null | undefined): boolean {
  if (s == null) return true;
  return String(s).trim() === "";
}

function hasAnySiteControlsText(siteControls: BuilderProgressInput["siteControls"]): boolean {
  if (!siteControls || typeof siteControls !== "object") return false;
  const { bin_setup, signage_storage, contamination_controls, hazardous_controls } = siteControls;
  return (
    !isEmptyString(bin_setup) ||
    !isEmptyString(signage_storage) ||
    !isEmptyString(contamination_controls) ||
    !isEmptyString(hazardous_controls)
  );
}

function hasMonitoringEvidence(monitoring: BuilderProgressInput["monitoring"]): boolean {
  if (!monitoring) return false;
  const hasCadence = !isEmptyString(monitoring.reportingCadence);
  const hasMethods = Array.isArray(monitoring.methods) && monitoring.methods.length > 0;
  const hasDockets = !isEmptyString(monitoring.dockets_description);
  const usesSoftware = monitoring.uses_software === true;
  return hasCadence && (hasMethods || hasDockets || usesSoftware);
}

/**
 * Compute per-step status and the recommended next step.
 * All completion checks keyed by step id (no index-based logic).
 * - Project details: project_type, region, site address validated, start_date
 * - Facilities: primary contractor and/or every planned stream has facility/destination
 * - Site constraints: at least one constraint selected (optional for flow; counts when set)
 * - Waste streams: at least 1 stream, planned tonnes, disposal, destination per stream
 * - Resource inputs: optional (never blocks; always complete for next-step chain)
 * - Monitoring: cadence selected + (at least 1 evidence type OR uses software)
 * - Review: ready when 1–6 satisfied (review counts as complete when others done)
 */
export function computeBuilderProgress(inputs: BuilderProgressInput): BuilderStepProgress[] {
  const basicsComplete =
    !isEmptyString(inputs.projectType) &&
    !isEmptyString(inputs.region) &&
    inputs.siteAddressValidated === true &&
    !isEmptyString(inputs.startDate);

  const hasStreams = (inputs.wasteStreamsCount ?? 0) > 0;
  const facilitiesComplete =
    (hasStreams && inputs.allStreamsHaveDestination === true) ||
    !isEmptyString(inputs.primaryWasteContractorPartnerId);

  const siteConstraintsComplete =
    Array.isArray(inputs.constraints) && inputs.constraints.length > 0;

  const streamsComplete =
    hasStreams &&
    (inputs.hasPlannedTonnes === true) &&
    (inputs.allStreamsHaveDestination === true) &&
    (inputs.allStreamsHaveDisposal === true);

  const resourceInputsComplete = true;

  const monitoringComplete =
    hasMonitoringEvidence(inputs.monitoring) || hasAnySiteControlsText(inputs.siteControls);

  const reviewComplete =
    basicsComplete && streamsComplete && facilitiesComplete && monitoringComplete;

  const completion: Record<BuilderStepId, boolean> = {
    basics: basicsComplete,
    facilities: facilitiesComplete,
    siteConstraints: siteConstraintsComplete,
    streams: streamsComplete,
    resourceInputs: resourceInputsComplete,
    monitoring: monitoringComplete,
    review: reviewComplete,
  };

  const stepsForNext = BUILDER_STEPS.filter((s) => s.id !== "resourceInputs") as readonly {
    id: BuilderStepId;
    label: string;
  }[];
  const recommendedNextId: BuilderStepId | null =
    stepsForNext.find((s) => !completion[s.id])?.id ?? null;

  return BUILDER_STEPS.map((step) => {
    const complete = completion[step.id];
    const isRecommended = step.id === recommendedNextId;
    const status: StepStatus = complete
      ? "complete"
      : isRecommended
        ? "recommendedNext"
        : "not_started";
    return {
      stepId: step.id,
      label: step.label,
      status,
    };
  });
}

export function countCompleteSteps(progress: BuilderStepProgress[]): number {
  return progress.filter((p) => p.status === "complete").length;
}
