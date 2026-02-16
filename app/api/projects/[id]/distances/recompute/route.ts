import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress, getDistanceMatrix } from "@/lib/maps/googleMaps";

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
    .select("id, user_id, site_address, address, site_lat, site_lng")
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
  return { supabase, projectId, project } as const;
}

/**
 * POST /api/projects/:id/distances/recompute
 * Ensure project has site lat/lng (geocode if missing), fetch facilities with lat/lng,
 * call Distance Matrix in batches, upsert project_facility_distances.
 * Returns { updated, skipped_facility_ids, project_geocoded }.
 */
export async function POST(_req: Request, { params }: ProjectIdParams) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access.error;
  const { supabase, projectId: id, project } = access;

  let siteLat = project.site_lat != null ? Number(project.site_lat) : null;
  let siteLng = project.site_lng != null ? Number(project.site_lng) : null;
  let projectGeocoded = false;

  if (siteLat == null || siteLng == null || !Number.isFinite(siteLat) || !Number.isFinite(siteLng)) {
    const address = (project.site_address ?? project.address ?? "").trim();
    if (!address) {
      return NextResponse.json(
        { error: "Project has no site address; set address and geocode first." },
        { status: 400 }
      );
    }
    const coords = await geocodeAddress(address);
    if (!coords) {
      return NextResponse.json(
        { error: "Could not geocode project address. Check GOOGLE_MAPS_API_KEY." },
        { status: 502 }
      );
    }
    siteLat = coords.lat;
    siteLng = coords.lng;
    await supabase
      .from("projects")
      .update({ site_lat: siteLat, site_lng: siteLng, ...(project.site_address == null ? { site_address: address } : {}) })
      .eq("id", id);
    projectGeocoded = true;
  }

  const { data: facilities, error: facErr } = await supabase
    .from("facilities")
    .select("id, lat, lng");

  if (facErr) {
    return NextResponse.json({ error: facErr.message }, { status: 500 });
  }

  const withCoords: { id: string; lat: number; lng: number }[] = [];
  const skippedFacilityIds: string[] = [];

  for (const f of facilities ?? []) {
    const lat = f.lat != null ? Number(f.lat) : null;
    const lng = f.lng != null ? Number(f.lng) : null;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      withCoords.push({ id: f.id, lat, lng });
    } else {
      skippedFacilityIds.push(f.id);
    }
  }

  if (withCoords.length === 0) {
    return NextResponse.json({
      updated: 0,
      skipped_facility_ids: skippedFacilityIds,
      project_geocoded: projectGeocoded,
      message: "No facilities with lat/lng. Geocode facilities first.",
    });
  }

  const destinations = withCoords.map((f) => ({ facilityId: f.id, lat: f.lat, lng: f.lng }));
  const results = await getDistanceMatrix({ lat: siteLat, lng: siteLng }, destinations);

  let updated = 0;
  for (const row of results) {
    const { error: upsertErr } = await supabase
      .from("project_facility_distances")
      .upsert(
        {
          project_id: id,
          facility_id: row.facilityId,
          distance_m: row.distance_m,
          duration_s: row.duration_s,
          provider: "google",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,facility_id" }
      );
    if (!upsertErr) updated += 1;
  }

  return NextResponse.json({
    updated,
    skipped_facility_ids: skippedFacilityIds,
    project_geocoded: projectGeocoded,
  });
}
