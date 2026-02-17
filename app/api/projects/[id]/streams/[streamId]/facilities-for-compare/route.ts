import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

type FacilityRow = {
  id: string;
  name: string;
  partner_id: string;
  accepted_streams: string[];
};

type DistanceRow = {
  facility_id: string;
  distance_m: number;
  duration_s: number;
};

type PartnerRow = { id: string; name: string };

export type FacilityForCompare = {
  id: string;
  name: string;
  partner_id: string;
  partner_name: string;
  accepts_stream: boolean;
  distance_km: number | null;
  duration_min: number | null;
};

/**
 * GET /api/projects/:projectId/streams/:streamId/facilities-for-compare
 * Returns all facilities with partner, accepts_stream (for this stream), and distance/duration when cached.
 * Used by Compare Facilities modal. Reuses same data sources as facility-optimiser (no heavy refetch).
 */
export async function GET(_req: Request, { params }: Params) {
  const { id: projectId, streamId: encodedStreamId } = await params;
  const streamName = decodeURIComponent(encodedStreamId ?? "").trim();
  if (!streamName) {
    return NextResponse.json({ error: "Missing stream id" }, { status: 400 });
  }

  const access = await requireProjectAccess(projectId);
  if (access.error) return access.error;
  const { supabase } = access;

  const [facilitiesRes, distancesRes, partnersRes] = await Promise.all([
    supabase.from("facilities").select("id, name, partner_id, accepted_streams"),
    supabase
      .from("project_facility_distances")
      .select("facility_id, distance_m, duration_s")
      .eq("project_id", projectId),
    supabase.from("partners").select("id, name"),
  ]);

  const facilities = (facilitiesRes.data ?? []) as FacilityRow[];
  const distances = (distancesRes.data ?? []) as DistanceRow[];
  const partners = (partnersRes.data ?? []) as PartnerRow[];
  const partnerById = new Map(partners.map((p) => [p.id, p.name]));
  const distanceByFacility = new Map<string, { distance_m: number; duration_s: number }>();
  for (const d of distances) {
    if (d.facility_id != null) {
      distanceByFacility.set(d.facility_id, { distance_m: d.distance_m, duration_s: d.duration_s });
    }
  }

  const list: FacilityForCompare[] = facilities.map((f) => {
    const accepted = (f.accepted_streams ?? []) as string[];
    const accepts_stream = accepted.some((s) => String(s).trim() === streamName);
    const dist = distanceByFacility.get(f.id);
    return {
      id: f.id,
      name: f.name,
      partner_id: f.partner_id,
      partner_name: partnerById.get(f.partner_id) ?? "",
      accepts_stream,
      distance_km: dist != null ? Math.round((dist.distance_m / 1000) * 100) / 100 : null,
      duration_min: dist != null ? Math.round((dist.duration_s / 60) * 10) / 10 : null,
    };
  });

  list.sort((a, b) => {
    const da = a.distance_km;
    const db = b.distance_km;
    if (da != null && db != null) return da - db;
    if (da != null) return -1;
    if (db != null) return 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return NextResponse.json({
    facilities: list,
    partners: partners.map((p) => ({ id: p.id, name: p.name })),
  });
}
