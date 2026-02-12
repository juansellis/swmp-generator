import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type DashboardMetrics = {
  active_projects: number;
  total_waste_streams: number;
  facilities_linked: number;
  projects_ready_for_forecasting: number;
};

/**
 * GET /api/dashboard-metrics
 * Returns counts for the current user: active projects, waste streams, facilities linked, projects ready for forecasting.
 * Uses lightweight RPC (single DB round-trip).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .rpc("get_dashboard_metrics", { p_user_id: user.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row || typeof row !== "object") {
    return NextResponse.json({
      active_projects: 0,
      total_waste_streams: 0,
      facilities_linked: 0,
      projects_ready_for_forecasting: 0,
    } satisfies DashboardMetrics);
  }

  const metrics: DashboardMetrics = {
    active_projects: Number(row.active_projects ?? 0),
    total_waste_streams: Number(row.total_waste_streams ?? 0),
    facilities_linked: Number(row.facilities_linked ?? 0),
    projects_ready_for_forecasting: Number(row.projects_ready_for_forecasting ?? 0),
  };

  return NextResponse.json(metrics);
}
