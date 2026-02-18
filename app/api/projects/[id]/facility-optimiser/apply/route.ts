import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeSwmpInputs, SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";

type Params = { params: Promise<{ id: string }> };

async function requireProjectAccess(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();
  if (projectErr || !project) {
    return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  }
  if (project.user_id !== user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { supabase };
}

type Assignment = { stream_name: string; facility_id: string };

/**
 * POST /api/projects/:id/facility-optimiser/apply
 * Body: { assignments: { stream_name: string; facility_id: string }[] }
 * Applies stream → facility assignments to the latest swmp_inputs (same persistence as set_facility).
 * Does not alter autosave or other save flows.
 */
export async function POST(req: Request, { params }: Params) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if (access.error) return access.error;
  const { supabase } = access;

  let body: { assignments?: Assignment[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = body.assignments;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "Provide non-empty assignments array" }, { status: 400 });
  }
  const assignments = raw
    .map((a) => {
      const sn = typeof a?.stream_name === "string" ? a.stream_name.trim() : "";
      const fid = typeof a?.facility_id === "string" ? a.facility_id.trim() : "";
      return sn && fid ? { stream_name: sn, facility_id: fid } : null;
    })
    .filter((a): a is Assignment => a != null);
  if (assignments.length === 0) {
    return NextResponse.json({ error: "No valid assignments" }, { status: 400 });
  }

  const facilityIds = [...new Set(assignments.map((a) => a.facility_id))];
  const { data: facilityRows } = await supabase
    .from("facilities")
    .select("id, partner_id")
    .in("id", facilityIds);
  const partnerByFacilityId = new Map<string, string | null>(
    (facilityRows ?? []).map((f: { id: string; partner_id: string | null }) => [f.id, f.partner_id ?? null])
  );

  const { data: row, error: fetchErr } = await supabase
    .from("swmp_inputs")
    .select("id, " + SWMP_INPUTS_JSON_COLUMN)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const rowObj = row as unknown as Record<string, unknown> | null;
  const rawInputs = rowObj ? rowObj[SWMP_INPUTS_JSON_COLUMN] : null;
  const inputs = rawInputs
    ? normalizeSwmpInputs({ ...(rawInputs as object), project_id: projectId })
    : null;

  if (!inputs) {
    return NextResponse.json({ error: "No project inputs found" }, { status: 404 });
  }

  const assignmentByStream = new Map(assignments.map((a) => [a.stream_name, a]));
  const plans = inputs.waste_stream_plans ?? [];
  const updatedPlans = plans.map((p) => {
    const a = assignmentByStream.get((p.category ?? "").trim());
    if (!a) return p;
    const partnerId = partnerByFacilityId.get(a.facility_id) ?? p.partner_id ?? null;
    return {
      ...p,
      facility_id: a.facility_id,
      destination_mode: "facility" as const,
      partner_id: partnerId,
    };
  });
  const nextInputs = { ...inputs, waste_stream_plans: updatedPlans };

  const rowId = rowObj && typeof rowObj.id === "string" ? rowObj.id : null;
  if (rowId) {
    const { error: updateErr } = await supabase
      .from("swmp_inputs")
      .update({ [SWMP_INPUTS_JSON_COLUMN]: nextInputs })
      .eq("id", rowId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  } else {
    const { error: insertErr } = await supabase
      .from("swmp_inputs")
      .insert({ project_id: projectId, [SWMP_INPUTS_JSON_COLUMN]: nextInputs });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, applied: assignments.length });
}
