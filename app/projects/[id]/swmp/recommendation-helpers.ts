import type { StrategyRecommendation, StreamPlanItem } from "@/lib/planning/wasteStrategyBuilder";

/** True if the recommendation's conditions are already satisfied by current stream plans (from Inputs). */
export function isRecommendationResolved(
  rec: StrategyRecommendation,
  streamPlans: StreamPlanItem[]
): boolean {
  const action = rec.apply_action;
  if (!action?.payload || typeof action.payload !== "object") return false;
  const payload = action.payload as Record<string, unknown>;
  const streamName = typeof payload.stream_name === "string" ? payload.stream_name.trim() : null;

  switch (action.type) {
    case "mark_stream_separate":
      if (!streamName) return false;
      return streamPlans.some(
        (s) => s.stream_name === streamName && s.handling_mode === "separated"
      );
    case "set_facility":
      if (!streamName) return false;
      return streamPlans.some(
        (s) => s.stream_name === streamName && s.assigned_facility_id != null
      );
    case "set_outcome":
      return !streamPlans.some((s) => s.intended_outcome === "unknown");
    case "create_stream":
      if (!streamName) return false;
      return streamPlans.some((s) => s.stream_name === streamName);
    default:
      return false;
  }
}
