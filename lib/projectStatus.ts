/**
 * Project Status Engine
 * Derived from project data presence (swmp_inputs, swmps, future: forecasts).
 * No manual flags — status is computed from what exists in the DB.
 */

export type ProjectStatusState = "complete" | "in_progress" | "not_started";

export type ProjectStatusData = {
  /** At least one swmp_inputs row exists for the project */
  inputs_complete: boolean;
  /** Future: forecasting data started (no table yet) */
  forecasting_started: boolean;
  /** At least one swmps row exists for the project */
  outputs_generated: boolean;
};

export type ProjectStatus = {
  inputs: ProjectStatusState;
  forecasting: ProjectStatusState;
  outputs: ProjectStatusState;
};

/**
 * Compute display state for each phase from raw data presence.
 * - complete → green
 * - in_progress → amber
 * - not_started → grey
 */
export function computeProjectStatus(data: ProjectStatusData): ProjectStatus {
  const { inputs_complete, forecasting_started, outputs_generated } = data;

  return {
    inputs: inputs_complete ? "complete" : "not_started",
    forecasting: forecasting_started ? "complete" : "not_started",
    outputs: outputs_generated
      ? "complete"
      : inputs_complete
        ? "in_progress"
        : "not_started",
  };
}

export const STATUS_LABELS = {
  inputs: "Inputs",
  forecasting: "Forecasting",
  outputs: "Report",
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any;

/**
 * Fetch status data for a single project (for inputs page / overview).
 */
export async function fetchProjectStatusData(
  supabase: SupabaseClientAny,
  projectId: string
): Promise<ProjectStatusData> {
  const [inputsRes, swmpsRes] = await Promise.all([
    supabase.from("swmp_inputs").select("project_id").eq("project_id", projectId).limit(1),
    supabase.from("swmps").select("project_id").eq("project_id", projectId).limit(1),
  ]);

  const hasInputs = (inputsRes?.data?.length ?? 0) > 0;
  const hasOutputs = (swmpsRes?.data?.length ?? 0) > 0;

  return {
    inputs_complete: hasInputs,
    forecasting_started: false,
    outputs_generated: hasOutputs,
  };
}

/**
 * Fetch status data for multiple projects (for dashboard list).
 * Returns a Map of project_id -> ProjectStatusData.
 */
export async function fetchProjectStatusDataForProjects(
  supabase: SupabaseClientAny,
  projectIds: string[]
): Promise<Map<string, ProjectStatusData>> {
  if (projectIds.length === 0) return new Map();

  const [inputsRes, swmpsRes] = await Promise.all([
    supabase.from("swmp_inputs").select("project_id").in("project_id", projectIds),
    supabase.from("swmps").select("project_id").in("project_id", projectIds),
  ]);

  const inputsSet = new Set(
    (inputsRes?.data ?? []).map((r: { project_id: string }) => r.project_id)
  );
  const swmpsSet = new Set(
    (swmpsRes?.data ?? []).map((r: { project_id: string }) => r.project_id)
  );

  const map = new Map<string, ProjectStatusData>();
  for (const id of projectIds) {
    map.set(id, {
      inputs_complete: inputsSet.has(id),
      forecasting_started: false,
      outputs_generated: swmpsSet.has(id),
    });
  }
  return map;
}
