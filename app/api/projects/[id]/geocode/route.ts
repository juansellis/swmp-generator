import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/maps/googleMaps";

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
 * POST /api/projects/:id/geocode
 * Geocode project site_address (or address) and save site_lat, site_lng. Returns coords.
 */
export async function POST(_req: Request, { params }: ProjectIdParams) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access.error;
  const { supabase, projectId: id, project } = access;

  const address = (project.site_address ?? project.address ?? "").trim();
  if (!address) {
    return NextResponse.json(
      { error: "Project has no site address to geocode." },
      { status: 400 }
    );
  }

  const coords = await geocodeAddress(address);
  if (!coords) {
    return NextResponse.json(
      { error: "Geocoding failed or API key not configured." },
      { status: 502 }
    );
  }

  const { error: updateErr } = await supabase
    .from("projects")
    .update({
      site_lat: coords.lat,
      site_lng: coords.lng,
      ...(project.site_address == null && project.address ? { site_address: address } : {}),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ lat: coords.lat, lng: coords.lng });
}
