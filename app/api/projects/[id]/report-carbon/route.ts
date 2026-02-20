import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export type CarbonVehicleEntry = {
  id: string;
  factor_id: string;
  time_active_hours: number;
  notes: string | null;
  factor: {
    name: string;
    weight_range: string | null;
    fuel_type: string;
    avg_consumption_per_hr: number;
    consumption_unit: string;
    conversion_factor_kgco2e_per_unit: number;
  };
};

export type CarbonResourceEntry = {
  id: string;
  factor_id: string;
  quantity_used: number;
  notes: string | null;
  factor: {
    category: string;
    name: string;
    unit: string;
    conversion_factor_kgco2e_per_unit: number;
  };
};

async function requireProjectAccess(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();
  if (error || !project) {
    return { ok: false as const, response: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  }
  if (project.user_id !== user.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, supabase, projectId };
}

/**
 * GET /api/projects/:id/report-carbon
 * Returns carbon forecast data for the report (vehicle + resource entries joined to factors).
 * Auth: user must own the project.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if (!access.ok) return access.response;
  const { supabase } = access;

  let carbonVehicleEntries: CarbonVehicleEntry[] = [];
  let carbonResourceEntries: CarbonResourceEntry[] = [];
  try {
    const [vEntriesRes, rEntriesRes] = await Promise.all([
      supabase.from("project_carbon_vehicle_entries").select("*").eq("project_id", projectId),
      supabase.from("project_carbon_resource_entries").select("*").eq("project_id", projectId),
    ]);
    if (vEntriesRes.error || rEntriesRes.error) throw new Error("Carbon tables unavailable");
    const vEntries = (vEntriesRes.data ?? []) as Array<{
      id: string;
      factor_id: string;
      time_active_hours: number;
      notes: string | null;
    }>;
    const rEntries = (rEntriesRes.data ?? []) as Array<{
      id: string;
      factor_id: string;
      quantity_used: number;
      notes: string | null;
    }>;
    if (vEntries.length > 0) {
      const vFactorIds = [...new Set(vEntries.map((e) => e.factor_id))];
      const { data: vFactors } = await supabase
        .from("carbon_vehicle_factors")
        .select("id, name, weight_range, fuel_type, avg_consumption_per_hr, consumption_unit, conversion_factor_kgco2e_per_unit")
        .in("id", vFactorIds);
      const vFactorMap = new Map((vFactors ?? []).map((f: Record<string, unknown>) => [f.id as string, f]));
      carbonVehicleEntries = vEntries.map((e) => {
        const factor = vFactorMap.get(e.factor_id) as CarbonVehicleEntry["factor"] | undefined;
        return {
          id: e.id,
          factor_id: e.factor_id,
          time_active_hours: e.time_active_hours,
          notes: e.notes,
          factor:
            factor ??
            ({
              name: "—",
              weight_range: null,
              fuel_type: "—",
              avg_consumption_per_hr: 0,
              consumption_unit: "—",
              conversion_factor_kgco2e_per_unit: 0,
            } as CarbonVehicleEntry["factor"]),
        };
      });
    }
    if (rEntries.length > 0) {
      const rFactorIds = [...new Set(rEntries.map((e) => e.factor_id))];
      const { data: rFactors } = await supabase
        .from("carbon_resource_factors")
        .select("id, category, name, unit, conversion_factor_kgco2e_per_unit")
        .in("id", rFactorIds);
      const rFactorMap = new Map((rFactors ?? []).map((f: Record<string, unknown>) => [f.id as string, f]));
      carbonResourceEntries = rEntries.map((e) => {
        const factor = rFactorMap.get(e.factor_id) as CarbonResourceEntry["factor"] | undefined;
        return {
          id: e.id,
          factor_id: e.factor_id,
          quantity_used: e.quantity_used,
          notes: e.notes,
          factor:
            factor ??
            ({
              category: "—",
              name: "—",
              unit: "—",
              conversion_factor_kgco2e_per_unit: 0,
            } as CarbonResourceEntry["factor"]),
        };
      });
    }
  } catch {
    carbonVehicleEntries = [];
    carbonResourceEntries = [];
  }

  return NextResponse.json({
    carbonVehicleEntries,
    carbonResourceEntries,
  });
}
