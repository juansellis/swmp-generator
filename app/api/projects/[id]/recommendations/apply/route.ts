import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWasteStrategy } from "@/lib/planning/wasteStrategyBuilder";
import type { ApplyActionType, StrategyRecommendation, WasteStrategyResult } from "@/lib/planning/wasteStrategyBuilder";
import { normalizeSwmpInputs, defaultSwmpInputs, SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";
import type { SwmpInputs, WasteStreamPlanInput } from "@/lib/swmp/model";
import { ensureStreamInInputs, ensureMixedCDInInputs } from "@/lib/forecastAllocation";
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

function isUnknownOutcome(outcomes: string[] | undefined): boolean {
  const arr = outcomes ?? [];
  if (!arr.length) return true;
  const set = new Set(arr.map((o) => String(o).trim()));
  if (set.has("Landfill") || set.has("Reuse")) return false;
  if (set.has("Recycle") || set.has("Recover") || set.has("Cleanfill") || set.has("Reduce")) return false;
  return true;
}

function applyActionToInputs(
  inputs: SwmpInputs,
  action: { type: ApplyActionType; payload: unknown }
): SwmpInputs {
  const payload = action.payload && typeof action.payload === "object" ? (action.payload as Record<string, unknown>) : {};
  const streamName = typeof payload.stream_name === "string" ? payload.stream_name.trim() : null;

  switch (action.type) {
    case "mark_stream_separate": {
      if (!streamName) return inputs;
      const plans = (inputs.waste_stream_plans ?? []).map((p) =>
        p.category === streamName ? { ...p, handling_mode: "separated" as const } : p
      );
      return { ...inputs, waste_stream_plans: plans };
    }
    case "set_facility": {
      if (!streamName) return inputs;
      const facilityId = payload.facility_id != null ? String(payload.facility_id).trim() || null : null;
      const partnerId = payload.partner_id != null ? String(payload.partner_id).trim() || null : null;
      const plans = (inputs.waste_stream_plans ?? []).map((p) => {
        if (p.category !== streamName) return p;
        const next: WasteStreamPlanInput = { ...p };
        if (facilityId !== undefined) next.facility_id = facilityId;
        if (partnerId !== undefined) next.partner_id = partnerId;
        return next;
      });
      return { ...inputs, waste_stream_plans: plans };
    }
    case "set_outcome": {
      const raw = Array.isArray(payload.intended_outcomes) ? (payload.intended_outcomes as string[]) : [];
      const defaultOutcomes = raw.length ? [raw[0]] : ["Recycle"];
      const plans = (inputs.waste_stream_plans ?? []).map((p) =>
        isUnknownOutcome(p.intended_outcomes) ? { ...p, intended_outcomes: defaultOutcomes } : p
      );
      return { ...inputs, waste_stream_plans: plans };
    }
    case "create_stream": {
      if (!streamName) return inputs;
      return ensureStreamInInputs(inputs, streamName);
    }
    default:
      return inputs;
  }
}

/**
 * POST /api/projects/:id/recommendations/apply
 * Body: { recommendationId: string } | { action: ApplyActionType, payload: unknown }
 * Applies the recommendation (or raw action), updates swmp_inputs, recomputes strategy, returns WasteStrategyResult.
 */
export async function POST(req: Request, { params }: ProjectIdParams) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access.error;
  const { supabase } = access;

  let body: { recommendationId?: string; action?: ApplyActionType; payload?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let applyAction: { type: ApplyActionType; payload: unknown } | null = null;

  if (body.recommendationId) {
    const result = await buildWasteStrategy(projectId, supabase);
    const rec = result.recommendations.find((r: StrategyRecommendation) => r.id === body.recommendationId);
    if (!rec?.apply_action) {
      return NextResponse.json({ error: "Recommendation not found or not actionable" }, { status: 404 });
    }
    applyAction = rec.apply_action;
  } else if (body.action) {
    applyAction = { type: body.action, payload: body.payload ?? {} };
  }

  if (!applyAction) {
    return NextResponse.json({ error: "Provide recommendationId or action" }, { status: 400 });
  }

  const { data: inputRow, error: inputErr } = await supabase
    .from("swmp_inputs")
    .select("id, " + SWMP_INPUTS_JSON_COLUMN)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inputErr) {
    return NextResponse.json({ error: inputErr.message }, { status: 500 });
  }

  const inputRowData = (inputRow ?? null) as unknown as { id?: string; [k: string]: unknown } | null;
  const raw = inputRowData?.[SWMP_INPUTS_JSON_COLUMN];
  let inputs: SwmpInputs = raw ? normalizeSwmpInputs(raw) : defaultSwmpInputs(projectId);

  if (applyAction.type === "allocate_to_mixed") {
    inputs = ensureMixedCDInInputs(inputs);
    const inputRowId = inputRowData?.id;
    if (inputRowId) {
      const { error: updateErr } = await supabase
        .from("swmp_inputs")
        .update({ [SWMP_INPUTS_JSON_COLUMN]: inputs })
        .eq("id", inputRowId);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    } else {
      const { error: insertErr } = await supabase
        .from("swmp_inputs")
        .insert({ project_id: projectId, [SWMP_INPUTS_JSON_COLUMN]: inputs });
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    const { data: items } = await supabase
      .from("project_forecast_items")
      .select("id")
      .eq("project_id", projectId)
      .is("waste_stream_key", null);
    const ids = (items ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      const { error: batchErr } = await supabase
        .from("project_forecast_items")
        .update({ waste_stream_key: "Mixed C&D" })
        .in("id", ids);
      if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });
    }
    await syncForecastAllocationToInputs(supabase, projectId);
  } else {
    inputs = applyActionToInputs(inputs, applyAction);
    const inputRowId = inputRowData?.id;
    if (inputRowId) {
      const { error: updateErr } = await supabase
        .from("swmp_inputs")
        .update({ [SWMP_INPUTS_JSON_COLUMN]: inputs })
        .eq("id", inputRowId);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    } else {
      const { error: insertErr } = await supabase
        .from("swmp_inputs")
        .insert({ project_id: projectId, [SWMP_INPUTS_JSON_COLUMN]: inputs });
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  try {
    const result: WasteStrategyResult = await buildWasteStrategy(projectId, supabase);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to recompute strategy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
