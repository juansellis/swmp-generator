import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncForecastAllocationToInputs } from "@/lib/forecastApi";

type ProjectIdParams = { params: Promise<{ id: string }> };

async function requireProjectAccess(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return { error: response } as const;
  }
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();
  if (projectErr || !project) {
    const response = NextResponse.json({ error: "Project not found" }, { status: 404 });
    return { error: response } as const;
  }
  if (project.user_id !== user.id) {
    const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return { error: response } as const;
  }
  return { supabase, projectId } as const;
}

/**
 * POST /api/projects/:id/forecast/recompute
 * Recompute-by-sum: recompute all forecast item waste kg from raw fields,
 * persist to items, sync totals to swmp_inputs. Idempotent. Single source of truth.
 */
export async function POST(_req: Request, { params }: ProjectIdParams) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access.error;
  const { supabase } = access;

  try {
    const result = await syncForecastAllocationToInputs(supabase, projectId);
    return NextResponse.json({
      stream_totals: result.streamTotals,
      unallocated_count: result.unallocated_count,
      conversion_required_count: result.conversion_required_count,
      included_count: result.included_count,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recompute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
