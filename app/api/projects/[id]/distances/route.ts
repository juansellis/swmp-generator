import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
 * GET /api/projects/:id/distances
 * Returns cached distance stats plus facility geocode counts: count, last_updated_at, facilities_total, facilities_geocoded.
 */
export async function GET(_req: Request, { params }: ProjectIdParams) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access.error;
  const { supabase } = access;

  const [distancesRes, facilitiesRes] = await Promise.all([
    supabase
      .from("project_facility_distances")
      .select("updated_at")
      .eq("project_id", projectId),
    supabase.from("facilities").select("id, lat, lng"),
  ]);

  if (distancesRes.error) {
    return NextResponse.json({ error: distancesRes.error.message }, { status: 500 });
  }

  const list = (distancesRes.data ?? []) as { updated_at: string }[];
  const count = list.length;
  const lastUpdatedAt =
    list.length > 0
      ? list.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), list[0].updated_at)
      : null;

  const facilities = (facilitiesRes.data ?? []) as { id: string; lat: number | null; lng: number | null }[];
  const facilitiesTotal = facilities.length;
  const facilitiesGeocoded = facilities.filter(
    (f) => f.lat != null && f.lng != null && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng))
  ).length;

  return NextResponse.json({
    count,
    last_updated_at: lastUpdatedAt,
    facilities_total: facilitiesTotal,
    facilities_geocoded: facilitiesGeocoded,
  });
}
