import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeSwmpInputs, SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";

type Params = { params: Promise<{ id: string; streamId: string }> };

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

/**
 * POST /api/projects/:projectId/streams/:streamId/facility
 * Body: { facility_id: string }
 * Sets the stream plan's facility_id in the latest swmp_inputs, then returns success.
 * Client should refetch strategy and planning checklist after.
 */
export async function POST(req: Request, { params }: Params) {
  const { id: projectId, streamId: encodedStreamId } = await params;
  const streamCategory = decodeURIComponent(encodedStreamId ?? "");
  if (!streamCategory) {
    return NextResponse.json({ error: "Missing stream id" }, { status: 400 });
  }

  const access = await requireProjectAccess(projectId);
  if (access.error) return access.error;
  const { supabase } = access;

  let body: { facility_id?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const facilityId =
    body.facility_id != null && String(body.facility_id).trim() !== ""
      ? String(body.facility_id).trim()
      : null;

  let partnerId: string | null = null;
  if (facilityId) {
    const { data: fac } = await supabase.from("facilities").select("partner_id").eq("id", facilityId).maybeSingle();
    partnerId = fac?.partner_id != null ? String(fac.partner_id) : null;
  }

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

  const rawInputs = row
    ? (row as Record<string, unknown>)[SWMP_INPUTS_JSON_COLUMN]
    : null;
  const inputs = rawInputs ? normalizeSwmpInputs({ ...(rawInputs as object), project_id: projectId }) : null;

  if (!inputs) {
    return NextResponse.json({ error: "No project inputs found" }, { status: 404 });
  }

  const plans = inputs.waste_stream_plans ?? [];
  const planIndex = plans.findIndex((p) => (p.category ?? "").trim() === streamCategory);
  if (planIndex === -1) {
    return NextResponse.json({ error: "Stream plan not found" }, { status: 404 });
  }

  const updatedPlans = plans.map((p, i) => {
    if (i !== planIndex) return p;
    return {
      ...p,
      facility_id: facilityId,
      destination_mode: "facility",
      partner_id: partnerId ?? p.partner_id ?? null,
    };
  });
  const nextInputs = { ...inputs, waste_stream_plans: updatedPlans };

  const rowId = row && typeof (row as { id?: string }).id === "string" ? (row as { id: string }).id : null;
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

  return NextResponse.json({ ok: true });
}
