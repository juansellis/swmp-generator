import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";

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
 * GET /api/projects/:projectId/streams/:streamId/distance
 * Returns cached distance/duration for the stream plan (from project_facility_distances or project_custom_destination_distances).
 */
export async function GET(_req: Request, { params }: Params) {
  const { id: projectId, streamId: encodedStreamId } = await params;
  const streamCategory = decodeURIComponent(encodedStreamId ?? "");
  if (!streamCategory) {
    return NextResponse.json({ error: "Missing stream id" }, { status: 400 });
  }

  const access = await requireProjectAccess(projectId);
  if (access.error) return access.error;
  const { supabase } = access;

  const { data: latestInputs, error: inputsErr } = await supabase
    .from("swmp_inputs")
    .select(SWMP_INPUTS_JSON_COLUMN)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inputsErr || !latestInputs) {
    return NextResponse.json({ error: "Could not load project inputs." }, { status: 500 });
  }

  const inputs = (latestInputs as Record<string, unknown>)[SWMP_INPUTS_JSON_COLUMN];
  const plans = Array.isArray((inputs as Record<string, unknown>)?.waste_stream_plans)
    ? ((inputs as Record<string, unknown>).waste_stream_plans as Record<string, unknown>[])
    : [];
  const plan = plans.find(
    (p) => (p?.category != null && String(p.category).trim() === streamCategory)
  ) as Record<string, unknown> | undefined;

  if (!plan) {
    return NextResponse.json({ error: "Stream plan not found" }, { status: 404 });
  }

  const facilityId = plan.facility_id != null && String(plan.facility_id).trim() ? String(plan.facility_id).trim() : null;

  if (facilityId) {
    const { data: row, error: distErr } = await supabase
      .from("project_facility_distances")
      .select("distance_m, duration_s")
      .eq("project_id", projectId)
      .eq("facility_id", facilityId)
      .maybeSingle();

    if (distErr || !row) {
      return NextResponse.json({ error: "No cached distance" }, { status: 404 });
    }
    const distance_m = Number(row.distance_m);
    const duration_s = Number(row.duration_s);
    return NextResponse.json({
      distance_km: Math.round((distance_m / 1000) * 100) / 100,
      duration_min: Math.round((duration_s / 60) * 10) / 10,
    });
  }

  const customPlaceId = plan.custom_destination_place_id != null && String(plan.custom_destination_place_id).trim()
    ? String(plan.custom_destination_place_id).trim()
    : null;
  const customAddress = String(plan.custom_destination_address ?? plan.destination_override ?? plan.destination ?? "").trim();
  const placeIdForLookup = customPlaceId || (customAddress ? `geocoded:${encodeURIComponent(customAddress)}` : null);

  if (!placeIdForLookup) {
    return NextResponse.json({ error: "No cached distance" }, { status: 404 });
  }

  const { data: row, error: distErr } = await supabase
    .from("project_custom_destination_distances")
    .select("distance_m, duration_s")
    .eq("project_id", projectId)
    .eq("destination_place_id", placeIdForLookup)
    .maybeSingle();

  if (distErr || !row) {
    return NextResponse.json({ error: "No cached distance" }, { status: 404 });
  }
  const distance_m = Number(row.distance_m);
  const duration_s = Number(row.duration_s);
  return NextResponse.json({
    distance_km: Math.round((distance_m / 1000) * 100) / 100,
    duration_min: Math.round((duration_s / 60) * 10) / 10,
  });
}
