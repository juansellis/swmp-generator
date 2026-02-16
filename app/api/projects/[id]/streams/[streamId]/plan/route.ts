import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeSwmpInputs, SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";
import { INTENDED_OUTCOME_OPTIONS } from "@/lib/swmp/model";

const INTENDED_OUTCOME_SET = new Set<string>(INTENDED_OUTCOME_OPTIONS);

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
 * PATCH /api/projects/:projectId/streams/:streamId/plan
 * Body: { handling_mode?: "mixed" | "separated"; intended_outcomes?: string[] }
 * Updates the stream plan's handling_mode and/or intended_outcomes in the latest swmp_inputs.
 * Same persistence pattern as the facility route (read latest, patch one plan, write back).
 */
export async function PATCH(req: Request, { params }: Params) {
  const { id: projectId, streamId: encodedStreamId } = await params;
  const streamCategory = decodeURIComponent(encodedStreamId ?? "");
  if (!streamCategory) {
    return NextResponse.json({ error: "Missing stream id" }, { status: 400 });
  }

  const access = await requireProjectAccess(projectId);
  if (access.error) return access.error;
  const { supabase } = access;

  let body: { handling_mode?: "mixed" | "separated"; intended_outcomes?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const handling_mode =
    body.handling_mode === "separated" || body.handling_mode === "mixed"
      ? body.handling_mode
      : undefined;
  const rawOutcomes = body.intended_outcomes;
  const intended_outcomes =
    Array.isArray(rawOutcomes) && rawOutcomes.length > 0
      ? (rawOutcomes as string[])
          .map((o) => String(o ?? "").trim())
          .filter((o) => INTENDED_OUTCOME_SET.has(o))
      : undefined;

  if (handling_mode === undefined && intended_outcomes === undefined) {
    return NextResponse.json({ error: "Provide handling_mode and/or intended_outcomes" }, { status: 400 });
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
  const inputs = rawInputs
    ? normalizeSwmpInputs({ ...(rawInputs as object), project_id: projectId })
    : null;

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
      ...(handling_mode !== undefined && { handling_mode }),
      ...(intended_outcomes !== undefined && { intended_outcomes }),
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
