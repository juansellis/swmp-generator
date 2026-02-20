import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildWasteStrategy } from "@/lib/planning/wasteStrategyBuilder";
import { getPlanningChecklist } from "@/lib/planning/planningChecklist";
import { verifyReportExportToken } from "@/lib/reportPdfToken";
import { SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";
import { buildWasteChartData } from "@/lib/wasteChartData";
import type { SwmpInputsForChart } from "@/lib/wasteChartData";
import type { SupabaseClient } from "@supabase/supabase-js";

type Params = { params: Promise<{ id: string }> };

/** Project row fields needed for report cover and display. */
export type ReportExportProject = {
  id: string;
  name: string;
  site_address: string | null;
  address: string | null;
  region: string | null;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  client_name: string | null;
  client_logo_url: string | null;
  report_title: string | null;
  report_footer_override: string | null;
  main_contractor: string | null;
  swmp_owner: string | null;
  primary_waste_contractor_partner_id: string | null;
};

/** Org branding for logos and colours. */
export type ReportExportBranding = {
  org_name: string | null;
  org_logo_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  client_name: string | null;
  client_logo_url: string | null;
  footer_text: string | null;
  website: string | null;
};

/** Per-stream export display: human-readable destination and distance (only when destination set). */
export type StreamExportDisplay = {
  destinationDisplay: string;
  distanceDisplay: string;
};

export type ReportExportData = {
  project: ReportExportProject;
  wasteStrategy: Awaited<ReturnType<typeof buildWasteStrategy>>;
  chartInputs: SwmpInputsForChart | null;
  chartData: ReturnType<typeof buildWasteChartData>;
  planningChecklist: Awaited<ReturnType<typeof getPlanningChecklist>> | null;
  forecastItems: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit: string;
    excess_percent: number;
    waste_stream_key: string | null;
    computed_waste_kg: number | null;
  }>;
  branding: ReportExportBranding;
  preparedAt: string;
  /** Resolved primary waste contractor name for cover; "Not set" when none selected. */
  primaryWasteContractorName: string | null;
  /** Per-stream destination (human name/address, never UUID) and distance (only when destination set). */
  streamExportDisplays: Record<string, StreamExportDisplay>;
  /** From inputs for export sections. */
  siteControls: { bin_setup: string; signage_storage: string; contamination_controls: string; hazardous_controls: string } | null;
  monitoring: { methods: string[]; uses_software: boolean; software_name: string | null; dockets_description: string } | null;
  responsibilities: Array<{ role: string; party: string; responsibilities: string[] }>;
  additional_responsibilities: Array<{ name: string; role: string; email?: string; phone?: string; responsibilities: string }>;
  notes: string | null;
  /** Carbon forecast: machinery/vehicles and water/energy/fuel (joined to factor libraries). */
  carbonVehicleEntries: Array<{
    id: string;
    factor_id: string;
    time_active_hours: number;
    notes: string | null;
    factor: {
      name: string;
      weight_range: string | null;
      fuel_type: string;
      avg_consumption_per_hr: number;
      consumption_unit: string;
      conversion_factor_kgco2e_per_unit: number;
    };
  }>;
  carbonResourceEntries: Array<{
    id: string;
    factor_id: string;
    quantity_used: number;
    notes: string | null;
    factor: { category: string; name: string; unit: string; conversion_factor_kgco2e_per_unit: number };
  }>;
};

async function getProjectAndAccess(
  projectId: string,
  token: string | null
): Promise<
  | { ok: true; supabase: SupabaseClient; projectId: string }
  | { ok: false; response: NextResponse }
> {
  if (token) {
    const verifiedId = verifyReportExportToken(token);
    if (!verifiedId || verifiedId !== projectId) {
      return { ok: false, response: NextResponse.json({ error: "Invalid or expired token" }, { status: 403 }) };
    }
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();
    if (error || !project) {
      return { ok: false, response: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
    }
    return { ok: true, supabase: supabaseAdmin, projectId };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();
  if (error || !project) {
    return { ok: false, response: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  }
  if (project.user_id !== user.id) {
    return { ok: false, response: NextResponse.json({ error: "Not allowed to access this project" }, { status: 403 }) };
  }
  return { ok: true, supabase, projectId };
}

/**
 * GET /api/projects/:id/report-export?token=xxx
 * Returns all data needed to render the report print view.
 * With valid token: no auth required (for server-side PDF generation).
 * Without token: requires auth and project ownership.
 */
export async function GET(req: Request, { params }: Params) {
  const { id: projectId } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await getProjectAndAccess(projectId, token);
  if (!access.ok) return access.response;
  const { supabase } = access;

  try {
    const projectSelect =
      "id, name, site_address, address, region, project_type, start_date, end_date, client_name, client_logo_url, report_title, report_footer_override, main_contractor, swmp_owner, primary_waste_contractor_partner_id, user_id";
    const { data: projectRow, error: projectErr } = await supabase
      .from("projects")
      .select(projectSelect)
      .eq("id", projectId)
      .single();

    if (projectErr || !projectRow) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = projectRow as ReportExportProject & { user_id?: string };

    const [inputsRes, strategy, checklist, forecastRes] = await Promise.all([
      supabase
        .from("swmp_inputs")
        .select(SWMP_INPUTS_JSON_COLUMN)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      buildWasteStrategy(projectId, supabase),
      getPlanningChecklist(projectId, supabase),
      supabase
        .from("project_forecast_items")
        .select("id, item_name, quantity, unit, excess_percent, waste_stream_key, computed_waste_kg")
        .eq("project_id", projectId),
    ]);

    const rawInputs = (inputsRes.data as { inputs?: unknown } | null)?.inputs ?? null;
    const chartInputs = rawInputs as SwmpInputsForChart | null;
    const chartData = buildWasteChartData(chartInputs);

    const forecastItems = (forecastRes.data ?? []) as ReportExportData["forecastItems"];

    const streamPlans = strategy.streamPlans ?? [];
    const facilityIds = new Set<string>();
    for (const s of streamPlans) {
      if (s.assigned_facility_id?.trim()) facilityIds.add(s.assigned_facility_id.trim());
      if (s.recommended_facility_id?.trim()) facilityIds.add(s.recommended_facility_id.trim());
    }
    const facilityList = facilityIds.size > 0
      ? await supabase.from("facilities").select("id, name, address").in("id", [...facilityIds])
      : { data: [] as { id: string; name: string; address?: string | null }[] | null };
    const facilityMap = new Map<string, { name: string; address: string }>();
    for (const f of facilityList.data ?? []) {
      const name = (f.name ?? "").trim() || "Facility";
      const address = (f.address ?? "").trim() || "";
      facilityMap.set(f.id, { name, address });
    }

    let primaryWasteContractorName: string | null = null;
    if (project.primary_waste_contractor_partner_id) {
      const { data: partner } = await supabase
        .from("partners")
        .select("name")
        .eq("id", project.primary_waste_contractor_partner_id)
        .maybeSingle();
      if (partner?.name) primaryWasteContractorName = String(partner.name).trim();
    }

    const streamExportDisplays: Record<string, StreamExportDisplay> = {};
    for (const s of streamPlans) {
      let destinationDisplay = "Not set";
      if (s.destination_mode === "custom") {
        const name = (s.custom_destination_name ?? "").trim();
        const addr = (s.custom_destination_address ?? "").trim();
        destinationDisplay = name || addr || "Custom destination";
      } else {
        const fid = s.assigned_facility_id ?? s.recommended_facility_id;
        if (fid && facilityMap.has(fid)) {
          const fa = facilityMap.get(fid)!;
          destinationDisplay = fa.address ? `${fa.name}, ${fa.address}` : fa.name;
        } else if (s.recommended_facility_name?.trim()) {
          destinationDisplay = s.recommended_facility_name.trim();
        }
      }
      const hasDestination = destinationDisplay !== "Not set";
      const distanceDisplay =
        hasDestination && s.distance_km != null && Number.isFinite(s.distance_km) && s.distance_km >= 0
          ? s.distance_km.toFixed(1)
          : hasDestination
            ? "—"
            : "";
      streamExportDisplays[s.stream_name] = { destinationDisplay, distanceDisplay };
    }

    const inputsObj = rawInputs && typeof rawInputs === "object" ? rawInputs as Record<string, unknown> : null;
    const siteControls = inputsObj?.site_controls && typeof inputsObj.site_controls === "object"
      ? (inputsObj.site_controls as ReportExportData["siteControls"])
      : null;
    const monitoring = inputsObj?.monitoring && typeof inputsObj.monitoring === "object"
      ? (inputsObj.monitoring as ReportExportData["monitoring"])
      : null;
    const responsibilities = Array.isArray(inputsObj?.responsibilities)
      ? (inputsObj.responsibilities as ReportExportData["responsibilities"])
      : [];
    const notes = inputsObj?.notes != null && String(inputsObj.notes).trim() !== ""
      ? String(inputsObj.notes).trim()
      : null;
    const additional_responsibilities = Array.isArray(inputsObj?.additional_responsibilities)
      ? (inputsObj.additional_responsibilities as ReportExportData["additional_responsibilities"])
      : [];

    let branding: ReportExportBranding = {
      org_name: null,
      org_logo_url: null,
      brand_primary: null,
      brand_secondary: null,
      client_name: project.client_name ?? null,
      client_logo_url: project.client_logo_url ?? null,
      footer_text: project.report_footer_override ?? null,
      website: null,
    };

    if (project.user_id) {
      const { data: member } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", project.user_id)
        .limit(1)
        .maybeSingle();
      if (member?.org_id) {
        const { data: org } = await supabase
          .from("orgs")
          .select("name, logo_url, brand_primary, brand_primary_colour, brand_secondary, footer_text, website")
          .eq("id", member.org_id)
          .maybeSingle();
        if (org) {
          branding = {
            org_name: org.name ?? null,
            org_logo_url: org.logo_url ?? null,
            brand_primary: org.brand_primary_colour ?? org.brand_primary ?? null,
            brand_secondary: org.brand_secondary ?? null,
            client_name: project.client_name ?? null,
            client_logo_url: project.client_logo_url ?? null,
            footer_text: project.report_footer_override ?? org.footer_text ?? null,
            website: org.website ?? null,
          };
        }
      }
    }

    let carbonVehicleEntries: ReportExportData["carbonVehicleEntries"] = [];
    let carbonResourceEntries: ReportExportData["carbonResourceEntries"] = [];
    try {
      const [vEntriesRes, rEntriesRes] = await Promise.all([
        supabase.from("project_carbon_vehicle_entries").select("*").eq("project_id", projectId),
        supabase.from("project_carbon_resource_entries").select("*").eq("project_id", projectId),
      ]);
      if (vEntriesRes.error || rEntriesRes.error) throw new Error("Carbon tables unavailable");
      const vEntries = (vEntriesRes.data ?? []) as Array<{ id: string; factor_id: string; time_active_hours: number; notes: string | null }>;
      const rEntries = (rEntriesRes.data ?? []) as Array<{ id: string; factor_id: string; quantity_used: number; notes: string | null }>;
      if (vEntries.length > 0) {
        const vFactorIds = [...new Set(vEntries.map((e) => e.factor_id))];
        const { data: vFactors } = await supabase
          .from("carbon_vehicle_factors")
          .select("id, name, weight_range, fuel_type, avg_consumption_per_hr, consumption_unit, conversion_factor_kgco2e_per_unit")
          .in("id", vFactorIds);
        const vFactorMap = new Map((vFactors ?? []).map((f: Record<string, unknown>) => [f.id as string, f]));
        carbonVehicleEntries = vEntries.map((e) => {
          const factor = vFactorMap.get(e.factor_id) as ReportExportData["carbonVehicleEntries"][0]["factor"] | undefined;
          return {
            id: e.id,
            factor_id: e.factor_id,
            time_active_hours: e.time_active_hours,
            notes: e.notes,
            factor: factor ?? {
              name: "—",
              weight_range: null,
              fuel_type: "—",
              avg_consumption_per_hr: 0,
              consumption_unit: "—",
              conversion_factor_kgco2e_per_unit: 0,
            },
          };
        });
      }
      if (rEntries.length > 0) {
        const rFactorIds = [...new Set(rEntries.map((e) => e.factor_id))];
        const { data: rFactors } = await supabase
          .from("carbon_resource_factors")
          .select("id, category, name, unit, conversion_factor_kgco2e_per_unit")
          .in("id", rFactorIds);
        const rFactorMap = new Map((rFactors ?? []).map((f: Record<string, unknown>) => [f.id as string, f]));
        carbonResourceEntries = rEntries.map((e) => {
          const factor = rFactorMap.get(e.factor_id) as ReportExportData["carbonResourceEntries"][0]["factor"] | undefined;
          return {
            id: e.id,
            factor_id: e.factor_id,
            quantity_used: e.quantity_used,
            notes: e.notes,
            factor: factor ?? { category: "—", name: "—", unit: "—", conversion_factor_kgco2e_per_unit: 0 },
          };
        });
      }
    } catch {
      carbonVehicleEntries = [];
      carbonResourceEntries = [];
    }

    const { primary_waste_contractor_partner_id: _pid, user_id: _uid, ...projectClean } = project;
    const preparedAt = new Date().toISOString();

    const data: ReportExportData = {
      project: projectClean as ReportExportProject,
      wasteStrategy: strategy,
      chartInputs,
      chartData,
      planningChecklist: checklist,
      forecastItems,
      branding,
      preparedAt,
      primaryWasteContractorName,
      streamExportDisplays,
      siteControls,
      monitoring,
      responsibilities,
      additional_responsibilities,
      notes,
      carbonVehicleEntries,
      carbonResourceEntries,
    };

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load report data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
