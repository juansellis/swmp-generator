import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDistance } from "@/lib/maps/distance";
import { geocodeAddress } from "@/lib/maps/googleMaps";
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
    .select("id, user_id, site_lat, site_lng")
    .eq("id", projectId)
    .single();
  if (projectErr || !project) {
    return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  }
  if (project.user_id !== user.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { supabase, project };
}

/**
 * POST /api/projects/:projectId/streams/:streamId/distance/recompute
 * Fetches project site lat/lng, stream plan (from latest swmp_inputs), computes distance to facility or custom destination, upserts cache.
 * Returns { distance_km, duration_min }.
 */
export async function POST(_req: Request, { params }: Params) {
  const { id: projectId, streamId: encodedStreamId } = await params;
  const streamCategory = decodeURIComponent(encodedStreamId ?? "");
  if (!streamCategory) {
    return NextResponse.json({ error: "Missing stream id" }, { status: 400 });
  }

  const access = await requireProjectAccess(projectId);
  if (access.error) return access.error;
  const { supabase, project } = access;

  const siteLat = project.site_lat != null ? Number(project.site_lat) : null;
  const siteLng = project.site_lng != null ? Number(project.site_lng) : null;
  if (siteLat == null || siteLng == null || !Number.isFinite(siteLat) || !Number.isFinite(siteLng)) {
    return NextResponse.json(
      { error: "Project site has no lat/lng. Set and validate site address first." },
      { status: 400 }
    );
  }
  const origin = { lat: siteLat, lng: siteLng };

  const { data: latestInputs, error: inputsErr } = await supabase
    .from("swmp_inputs")
    .select("id, " + SWMP_INPUTS_JSON_COLUMN)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inputsErr || !latestInputs) {
    return NextResponse.json({ error: "Could not load project inputs." }, { status: 500 });
  }

  const inputsRow = latestInputs as unknown as Record<string, unknown>;
  const inputs = inputsRow[SWMP_INPUTS_JSON_COLUMN] as Record<string, unknown> | undefined;
  const plans = Array.isArray(inputs?.waste_stream_plans)
    ? (inputs.waste_stream_plans as Record<string, unknown>[])
    : [];
  const plan = plans.find(
    (p) => (p?.category != null && String(p.category).trim() === streamCategory)
  ) as Record<string, unknown> | undefined;

  if (!plan) {
    return NextResponse.json({ error: "Stream plan not found" }, { status: 404 });
  }

  const facilityId = plan.facility_id != null && String(plan.facility_id).trim() ? String(plan.facility_id).trim() : null;
  const destinationMode = facilityId ? "facility" : "custom";

  if (destinationMode === "facility") {
    const { data: facility, error: facErr } = await supabase
      .from("facilities")
      .select("id, lat, lng")
      .eq("id", facilityId)
      .single();
    if (facErr || !facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }
    const lat = facility.lat != null ? Number(facility.lat) : null;
    const lng = facility.lng != null ? Number(facility.lng) : null;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Facility has no lat/lng. Set and validate facility address first." },
        { status: 400 }
      );
    }
    const result = await getDistance(origin, { lat, lng });
    if (!result) {
      return NextResponse.json(
        { error: "Distance computation failed. Check GOOGLE_MAPS_API_KEY." },
        { status: 502 }
      );
    }
    await supabase
      .from("project_facility_distances")
      .upsert(
        {
          project_id: projectId,
          facility_id: facilityId,
          distance_m: Math.round(result.distance_m),
          duration_s: Math.round(result.duration_s),
          provider: "google",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,facility_id" }
      );

    const distance_km = Math.round((result.distance_m / 1000) * 100) / 100;
    const duration_min = Math.round((result.duration_s / 60) * 10) / 10;
    await persistPlanDistance(supabase, projectId, latestInputs as unknown as Record<string, unknown>, streamCategory, distance_km, duration_min);
    return NextResponse.json({ distance_km, duration_min });
  }

  // custom destination
  const customPlaceId = plan.custom_destination_place_id != null && String(plan.custom_destination_place_id).trim()
    ? String(plan.custom_destination_place_id).trim()
    : null;
  let destLat: number | null = plan.custom_destination_lat != null ? Number(plan.custom_destination_lat) : null;
  let destLng: number | null = plan.custom_destination_lng != null ? Number(plan.custom_destination_lng) : null;
  const customAddress =
    (plan.custom_destination_address != null && String(plan.custom_destination_address).trim())
      ? String(plan.custom_destination_address).trim()
      : String(plan.destination_override ?? plan.destination ?? "").trim();
  const customName = String(plan.custom_destination_name ?? "").trim() || customAddress || null;

  if (customPlaceId && destLat != null && destLng != null && Number.isFinite(destLat) && Number.isFinite(destLng)) {
    // use stored custom destination coords
  } else if (customAddress) {
    const coords = await geocodeAddress(customAddress);
    if (!coords) {
      return NextResponse.json(
        { error: "Could not geocode custom destination address." },
        { status: 400 }
      );
    }
    destLat = coords.lat;
    destLng = coords.lng;
  } else {
    return NextResponse.json(
      { error: "Custom destination has no address or place_id/lat/lng. Set destination first." },
      { status: 400 }
    );
  }

  const result = await getDistance(origin, { lat: destLat!, lng: destLng! });
  if (!result) {
    return NextResponse.json(
      { error: "Distance computation failed. Check GOOGLE_MAPS_API_KEY." },
      { status: 502 }
    );
  }

  const placeIdForCache = customPlaceId || `geocoded:${encodeURIComponent(customAddress || "")}`;
  await supabase
    .from("project_custom_destination_distances")
    .upsert(
      {
        project_id: projectId,
        destination_place_id: placeIdForCache,
        destination_name: customName || null,
        destination_address: customAddress || null,
        destination_lat: destLat,
        destination_lng: destLng,
        distance_m: Math.round(result.distance_m),
        duration_s: Math.round(result.duration_s),
        provider: "google",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,destination_place_id" }
    );

  const distance_km = Math.round((result.distance_m / 1000) * 100) / 100;
  const duration_min = Math.round((result.duration_s / 60) * 10) / 10;
  await persistPlanDistance(supabase, projectId, latestInputs as unknown as Record<string, unknown>, streamCategory, distance_km, duration_min);
  return NextResponse.json({ distance_km, duration_min });
}

/** Persist distance_km and duration_min to the plan in swmp_inputs so strategy/cards/table see canonical distance. */
async function persistPlanDistance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  latestInputs: Record<string, unknown>,
  streamCategory: string,
  distance_km: number,
  duration_min: number
): Promise<void> {
  const rowId = latestInputs.id as string | undefined;
  if (!rowId) return;
  const inputs = (latestInputs[SWMP_INPUTS_JSON_COLUMN] ?? {}) as Record<string, unknown>;
  const plans = Array.isArray(inputs.waste_stream_plans) ? [...inputs.waste_stream_plans] as Record<string, unknown>[] : [];
  const idx = plans.findIndex((p) => p?.category != null && String(p.category).trim() === streamCategory);
  if (idx === -1) return;
  const plan = { ...plans[idx], distance_km, duration_min };
  plans[idx] = plan;
  const nextInputs = { ...inputs, waste_stream_plans: plans };
  await supabase.from("swmp_inputs").update({ [SWMP_INPUTS_JSON_COLUMN]: nextInputs }).eq("id", rowId);
}
