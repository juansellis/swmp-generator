import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aggregateDistinctMetrics } from "@/lib/dashboardMetrics";
import { planManualQtyToTonnes } from "@/lib/wasteStreamDefaults";

/**
 * Project Intelligence metrics (camelCase for API contract).
 * All counts are derived from DB via direct queries; scoped to the authenticated user.
 */
export type DashboardMetricsResponse = {
  activeProjects: number;
  totalWasteStreamsConfigured: number;
  facilitiesLinked: number;
  totalEstimatedWasteTonnes: number;
};

type SwmpInputsRow = {
  project_id: string;
  inputs: Record<string, unknown>;
  created_at: string;
};

/**
 * GET /api/dashboard/metrics
 * Returns Project Intelligence metrics for the current user.
 * Uses direct Supabase queries (no RPC). Auth: only authenticated users.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1) Active projects: count projects for user. If schema adds archived, filter .eq('archived', false).
  const { data: projectsData, error: projectsErr } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id);

  if (projectsErr) {
    return NextResponse.json({ error: projectsErr.message }, { status: 500 });
  }

  const projectIds = (projectsData ?? []).map((p: { id: string }) => p.id);
  const activeProjects = projectIds.length;

  if (projectIds.length === 0) {
    return NextResponse.json(defaultMetrics(activeProjects));
  }

  // 2) Latest swmp_inputs per project: fetch all inputs for user's projects, then take latest per project in JS
  const { data: inputsData, error: inputsErr } = await supabase
    .from("swmp_inputs")
    .select("project_id, inputs, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (inputsErr) {
    return NextResponse.json({ error: inputsErr.message }, { status: 500 });
  }

  const rows = (inputsData ?? []) as SwmpInputsRow[];
  const latestByProject = new Map<string, SwmpInputsRow>();
  for (const row of rows) {
    if (!latestByProject.has(row.project_id)) {
      latestByProject.set(row.project_id, row);
    }
  }

  type PlanForTonnes = {
    category?: string;
    manual_qty_tonnes?: number | null;
    forecast_qty?: number | null;
    estimated_qty?: number | null;
    unit?: string | null;
    density_kg_m3?: number | null;
    thickness_m?: number | null;
  };

  const latestInputsRows = Array.from(latestByProject.values()).map((row) => ({ inputs: row.inputs }));
  const { totalWasteStreamsConfigured, facilitiesLinked } = aggregateDistinctMetrics(latestInputsRows);

  let totalEstimatedWasteTonnes = 0;
  for (const { inputs } of latestByProject.values()) {
    const plans = (inputs?.waste_stream_plans as PlanForTonnes[] | undefined) ?? [];
    for (const p of plans) {
      const streamLabel = (p?.category ?? "").trim() || "Mixed C&D";
      const manualTonnes =
        p?.manual_qty_tonnes != null && Number.isFinite(p.manual_qty_tonnes) && p.manual_qty_tonnes >= 0
          ? p.manual_qty_tonnes
          : (planManualQtyToTonnes(p, streamLabel) ?? 0);
      const forecastTonnes =
        p?.forecast_qty != null && Number.isFinite(p.forecast_qty) && p.forecast_qty >= 0 ? p.forecast_qty : 0;
      totalEstimatedWasteTonnes += manualTonnes + forecastTonnes;
    }
  }

  const metrics: DashboardMetricsResponse = {
    activeProjects,
    totalWasteStreamsConfigured: Math.round(totalWasteStreamsConfigured),
    facilitiesLinked: Math.round(facilitiesLinked),
    totalEstimatedWasteTonnes,
  };

  return NextResponse.json(metrics);
}

function defaultMetrics(activeProjects = 0): DashboardMetricsResponse {
  return {
    activeProjects,
    totalWasteStreamsConfigured: 0,
    facilitiesLinked: 0,
    totalEstimatedWasteTonnes: 0,
  };
}
