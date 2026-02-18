import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWasteStrategy } from "@/lib/planning/wasteStrategyBuilder";
import {
  runFacilityOptimiser,
  type OptimiserWeights,
  type FacilityCandidate,
} from "@/lib/planning/facilityOptimiser";
import {
  buildDistanceMapFromRows,
  getDistanceForFacility,
} from "@/lib/distance/getProjectFacilityDistanceMap";
import {
  computeCostEstimate,
  computeCarbonEstimate,
} from "@/lib/planning/costCarbonStubs";

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
 * Returns status (project geocode, facilities geocoded, distances cached, last updated) and nearest facilities per stream (top 3 by distance).
 */
export async function GET(_req: Request, { params }: Params) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if (access.error) return access.error;
  const { supabase } = access;

  const [strategyResult, projectRes, facilitiesRes, distancesRes, partnersRes] = await Promise.all([
    buildWasteStrategy(projectId, supabase).catch(() => null),
    supabase.from("projects").select("site_lat, site_lng, site_address, address").eq("id", projectId).single(),
    supabase
      .from("facilities")
      .select("id, name, partner_id, accepted_streams, lat, lng"),
    supabase
      .from("project_facility_distances")
      .select("facility_id, distance_m, duration_s, updated_at")
      .eq("project_id", projectId),
    supabase.from("partners").select("id, name"),
  ]);

  const project = projectRes.data as { site_lat: number | null; site_lng: number | null; site_address?: string | null; address?: string | null } | null;
  const facilities = (facilitiesRes.data ?? []) as FacilityRow[];
  const distances = (distancesRes.data ?? []) as DistanceRow[];
  const partners = (partnersRes.data ?? []) as PartnerRow[];
  const partnerById = new Map(partners.map((p) => [p.id, p.name]));

  const siteLat = project?.site_lat != null ? Number(project.site_lat) : null;
  const siteLng = project?.site_lng != null ? Number(project.site_lng) : null;
  const projectGeocoded =
    siteLat != null && siteLng != null && Number.isFinite(siteLat) && Number.isFinite(siteLng);
  const projectHasAddress = Boolean(
    (project?.site_address ?? project?.address ?? "").trim()
  );

  const facilitiesTotal = facilities.length;
  const facilitiesGeocoded = facilities.filter(
    (f) => f.lat != null && f.lng != null && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng))
  ).length;
  const geocodedFacilityIds = facilities
    .filter(
      (f) => f.lat != null && f.lng != null && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng))
    )
    .map((f) => f.id);
  const facilityIdsWithoutGeocode = facilities
    .filter(
      (f) =>
        f.lat == null ||
        f.lng == null ||
        !Number.isFinite(Number(f.lat)) ||
        !Number.isFinite(Number(f.lng))
    )
    .map((f) => f.id);
  const distancesCached = distances.length;
  const lastUpdatedAt =
    distances.length > 0
      ? distances.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), distances[0].updated_at)
      : null;

  const distanceMap = buildDistanceMapFromRows(distances);
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
    const assignedDist = assignedFacilityId ? getDistanceForFacility(distanceMap, assignedFacilityId) : null;

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
        const d = getDistanceForFacility(distanceMap, f.id);
        if (!d) return null;
        return {
          facility_id: f.id,
          facility_name: f.name,
          partner_name: partnerById.get(f.partner_id) ?? "",
          distance_km: d.distance_km,
          duration_min: d.duration_min,
          distance_m: d.distance_km * 1000,
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
        const d = getDistanceForFacility(distanceMap, f.id);
        if (!d) return { facility: f, distance_km: null as number | null, duration_min: null as number | null };
        return { facility: f, distance_km: d.distance_km, duration_min: d.duration_min };
      })
      .sort((a, b) => {
        if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
        if (a.distance_km != null) return -1;
        if (b.distance_km != null) return 1;
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
      const distance_not_computed = firstDist?.distance_km == null;
      recommended_facility = {
        facility_id: firstPartner.id,
        facility_name: firstPartner.name,
        distance_km: firstDist?.distance_km ?? null,
        duration_min: firstDist?.duration_min ?? null,
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
        canonicalDistanceKm ?? (assignedDist ? assignedDist.distance_km : null),
      assigned_duration_min:
        canonicalDurationMin ?? (assignedDist ? assignedDist.duration_min : null),
      recommended_facility,
      nearest: top3,
    });
  }

  return NextResponse.json({
    project_geocoded: projectGeocoded,
    project_has_address: projectHasAddress,
    facilities_geocoded: facilitiesGeocoded,
    facilities_total: facilitiesTotal,
    geocoded_facility_ids: geocodedFacilityIds,
    facility_ids_without_geocode: facilityIdsWithoutGeocode,
    distances_cached: distancesCached,
    last_updated_at: lastUpdatedAt,
    streams,
  });
}

/**
 * POST /api/projects/:id/facility-optimiser
 * Body: { weights?: { distance?: number; cost?: number; carbon?: number } }
 * Runs the optimiser and returns results (recommended facility per stream, alternatives, reason).
 */
export async function POST(req: Request, { params }: Params) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if (access.error) return access.error;
  const { supabase } = access;

  let body: { weights?: OptimiserWeights } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // empty body is ok
  }
  const weights = body.weights ?? { distance: 1 };

  const [strategyResult, projectRes, facilitiesRes, distancesRes, partnersRes] = await Promise.all([
    buildWasteStrategy(projectId, supabase).catch(() => null),
    supabase.from("projects").select("site_lat, site_lng").eq("id", projectId).single(),
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

  const distanceMap = buildDistanceMapFromRows(distances);

  const streamPlans = strategyResult?.streamPlans ?? [];
  const streamsWithTonnes = streamPlans.filter((s) => s.total_tonnes > 0);
  const streams: { stream_name: string; planned_tonnes: number }[] = streamsWithTonnes.map((s) => ({
    stream_name: s.stream_name,
    planned_tonnes: s.total_tonnes,
  }));

  const eligiblePerStream = new Map<string, FacilityCandidate[]>();
  for (const plan of streamsWithTonnes) {
    const streamName = plan.stream_name;
    const accepting = facilities.filter((f) => {
      const list = (f.accepted_streams ?? []) as string[];
      return list.some((s) => String(s).trim() === streamName);
    });
    const tonnes = Math.max(0, Number(plan.total_tonnes) || 0);
    const candidates: FacilityCandidate[] = accepting.map((f) => {
      const d = getDistanceForFacility(distanceMap, f.id);
      // TODO: Cost/carbon module — replace stubs with real computeCostEstimate/computeCarbonEstimate
      const costPerTonne = computeCostEstimate(projectId, f.id, streamName, tonnes);
      const carbonPerTonne = computeCarbonEstimate(projectId, f.id, streamName, tonnes);
      return {
        facility_id: f.id,
        facility_name: f.name,
        partner_id: f.partner_id,
        partner_name: partnerById.get(f.partner_id) ?? null,
        distance_km: d?.distance_km ?? null,
        duration_min: d?.duration_min ?? null,
        cost_per_tonne: costPerTonne ?? undefined,
        carbon_kg_co2e_per_tonne:
          carbonPerTonne != null && Number.isFinite(carbonPerTonne) ? carbonPerTonne : undefined,
      };
    });
    eligiblePerStream.set(streamName, candidates);
  }

  const results = runFacilityOptimiser({
    streams,
    eligiblePerStream,
    weights,
  });

  const facilitiesTotal = facilities.length;
  const facilitiesGeocoded = facilities.filter(
    (f) => f.lat != null && f.lng != null && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng))
  ).length;
  const distancesCached = distances.length;
  const lastUpdatedAt =
    distances.length > 0
      ? distances.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), distances[0].updated_at)
      : null;

  const proj = projectRes.data as { site_lat: number | null; site_lng: number | null } | null;
  const pLat = proj?.site_lat != null ? Number(proj.site_lat) : null;
  const pLng = proj?.site_lng != null ? Number(proj.site_lng) : null;
  const projectGeocoded = pLat != null && pLng != null && Number.isFinite(pLat) && Number.isFinite(pLng);
  const geocodedFacilityIds = facilities
    .filter(
      (f) => f.lat != null && f.lng != null && Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng))
    )
    .map((f) => f.id);

  return NextResponse.json({
    project_geocoded: projectGeocoded,
    geocoded_facility_ids: geocodedFacilityIds,
    facilities_geocoded: facilitiesGeocoded,
    facilities_total: facilitiesTotal,
    distances_cached: distancesCached,
    last_updated_at: lastUpdatedAt,
    results,
  });
}
