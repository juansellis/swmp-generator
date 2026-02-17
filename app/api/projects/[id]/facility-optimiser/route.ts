import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWasteStrategy } from "@/lib/planning/wasteStrategyBuilder";

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

type FacilityRow = {
  id: string;
  name: string;
  partner_id: string;
  accepted_streams: string[];
  lat: number | null;
  lng: number | null;
};

type DistanceRow = {
  facility_id: string;
  distance_m: number;
  duration_s: number;
  updated_at: string;
};

type PartnerRow = { id: string; name: string };

/**
 * GET /api/projects/:id/facility-optimiser
 * Returns status (facilities geocoded, distances cached, last updated) and nearest facilities per stream (top 3 by distance).
 */
export async function GET(_req: Request, { params }: Params) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if (access.error) return access.error;
  const { supabase } = access;

  const [strategyResult, facilitiesRes, distancesRes, partnersRes] = await Promise.all([
    buildWasteStrategy(projectId, supabase).catch(() => null),
    supabase
      .from("facilities")
      .select("id, name, partner_id, accepted_streams, lat, lng"),
    supabase
      .from("project_facility_distances")
      .select("facility_id, distance_m, duration_s, updated_at")
      .eq("project_id", projectId),
    supabase.from("partners").select("id, name"),
  ]);

  const facilities = (facilitiesRes.data ?? []) as FacilityRow[];
  const distances = (distancesRes.data ?? []) as DistanceRow[];
  const partners = (partnersRes.data ?? []) as PartnerRow[];
  const partnerById = new Map(partners.map((p) => [p.id, p.name]));

  const facilitiesTotal = facilities.length;
  const facilitiesGeocoded = facilities.filter(
    (f) => f.lat != null && f.lng != null && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng))
  ).length;
  const distancesCached = distances.length;
  const lastUpdatedAt =
    distances.length > 0
      ? distances.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), distances[0].updated_at)
      : null;

  const distanceByFacility = new Map<string | null, { distance_m: number; duration_s: number }>();
  for (const d of distances) {
    if (d.facility_id != null) {
      distanceByFacility.set(d.facility_id, { distance_m: d.distance_m, duration_s: d.duration_s });
    }
  }
  const facilityById = new Map(facilities.map((f) => [f.id, f]));

  const streamPlans = strategyResult?.streamPlans ?? [];
  const streamsWithTonnes = streamPlans.filter((s) => s.total_tonnes > 0);

  const streams: {
    stream_name: string;
    total_tonnes: number;
    assigned_facility_id: string | null;
    assigned_facility_name: string | null;
    /** Strict display: facility name, or custom name/address, or null (show "No destination selected."). Never partner/recommendation text. */
    assigned_destination_display: string | null;
    assigned_distance_km: number | null;
    assigned_duration_min: number | null;
    /** Partner-based recommended facility (effectivePartnerId → facilities accepting stream; min distance or first alphabetically). */
    recommended_facility: {
      facility_id: string;
      facility_name: string;
      distance_km: number | null;
      duration_min: number | null;
      distance_not_computed: boolean;
    } | null;
    nearest: {
      facility_id: string;
      facility_name: string;
      partner_name: string;
      distance_km: number;
      duration_min: number;
    }[];
  }[] = [];

  for (const plan of streamsWithTonnes) {
    const streamName = plan.stream_name;
    const assignedFacilityId = plan.assigned_facility_id ?? null;
    const assignedFacility = assignedFacilityId ? facilityById.get(assignedFacilityId) : null;
    const assignedDist = assignedFacilityId ? distanceByFacility.get(assignedFacilityId) : null;

    // Strict destination display: only actual selected destination; never recommendation/partner as selected.
    let assigned_destination_display: string | null = null;
    if (plan.destination_mode === "custom") {
      const name = (plan.custom_destination_name ?? "").trim();
      const addr = (plan.custom_destination_address ?? "").trim();
      if (name || addr) assigned_destination_display = name || addr;
    }
    if (assigned_destination_display == null && plan.destination_mode === "facility" && assignedFacilityId && assignedFacility) {
      assigned_destination_display = assignedFacility.name;
    }

    // All facilities that accept this stream (for nearest list).
    const accepting = facilities.filter((f) => {
      const streams = (f.accepted_streams ?? []) as string[];
      return streams.some((s) => String(s).trim() === streamName);
    });
    const withDistance = accepting
      .map((f) => {
        const d = distanceByFacility.get(f.id);
        if (!d) return null;
        return {
          facility_id: f.id,
          facility_name: f.name,
          partner_name: partnerById.get(f.partner_id) ?? "",
          distance_km: Math.round((d.distance_m / 1000) * 100) / 100,
          duration_min: Math.round((d.duration_s / 60) * 10) / 10,
          distance_m: d.distance_m,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => a.distance_m - b.distance_m);
    const top3 = withDistance.slice(0, 3).map(({ distance_m: _, ...rest }) => rest);

    // Partner-based recommendation: effectivePartnerId = stream.partner_id ?? project.primary_waste_contractor_partner_id.
    const effectivePartnerId = plan.partner_id ?? null;
    const partnerFacilities = effectivePartnerId
      ? accepting.filter((f) => f.partner_id === effectivePartnerId)
      : [];
    const withDistancePartner = partnerFacilities
      .map((f) => {
        const d = distanceByFacility.get(f.id);
        if (!d) return { facility: f, distance_m: null as number | null, duration_s: null as number | null };
        return {
          facility: f,
          distance_m: d.distance_m as number,
          duration_s: d.duration_s as number,
        };
      })
      .sort((a, b) => {
        if (a.distance_m != null && b.distance_m != null) return a.distance_m - b.distance_m;
        if (a.distance_m != null) return -1;
        if (b.distance_m != null) return 1;
        return (a.facility.name ?? "").localeCompare(b.facility.name ?? "");
      });
    const firstPartner = withDistancePartner[0]?.facility;
    const firstDist = withDistancePartner[0];
    let recommended_facility: {
      facility_id: string;
      facility_name: string;
      distance_km: number | null;
      duration_min: number | null;
      distance_not_computed: boolean;
    } | null = null;
    if (firstPartner) {
      const distance_not_computed = firstDist?.distance_m == null;
      recommended_facility = {
        facility_id: firstPartner.id,
        facility_name: firstPartner.name,
        distance_km:
          firstDist?.distance_m != null
            ? Math.round((firstDist.distance_m / 1000) * 100) / 100
            : null,
        duration_min:
          firstDist?.duration_s != null
            ? Math.round((firstDist.duration_s / 60) * 10) / 10
            : null,
        distance_not_computed,
      };
    }

    const canonicalDistanceKm =
      plan.distance_km != null && Number.isFinite(plan.distance_km) && plan.distance_km >= 0
        ? plan.distance_km
        : null;
    const canonicalDurationMin =
      plan.duration_min != null && Number.isFinite(plan.duration_min) && plan.duration_min >= 0
        ? plan.duration_min
        : null;
    streams.push({
      stream_name: streamName,
      total_tonnes: plan.total_tonnes,
      assigned_facility_id: assignedFacilityId,
      assigned_facility_name: assignedFacility?.name ?? null,
      assigned_destination_display,
      assigned_distance_km:
        canonicalDistanceKm ??
        (assignedDist ? Math.round((assignedDist.distance_m / 1000) * 100) / 100 : null),
      assigned_duration_min:
        canonicalDurationMin ??
        (assignedDist ? Math.round((assignedDist.duration_s / 60) * 10) / 10 : null),
      recommended_facility,
      nearest: top3,
    });
  }

  return NextResponse.json({
    facilities_geocoded: facilitiesGeocoded,
    facilities_total: facilitiesTotal,
    distances_cached: distancesCached,
    last_updated_at: lastUpdatedAt,
    streams,
  });
}
