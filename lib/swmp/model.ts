/**
 * Canonical SWMP input model.
 * Single source of truth for shape, defaults, and migration of saved inputs.
 */

// ---------------------------------------------------------------------------
// Plan units and waste stream plan shape
// ---------------------------------------------------------------------------

export const PLAN_UNIT_OPTIONS = ["kg", "t", "m3", "m2", "L"] as const;
export type PlanUnit = (typeof PLAN_UNIT_OPTIONS)[number];

const VALID_UNITS = new Set<string>(PLAN_UNIT_OPTIONS);

export const INTENDED_OUTCOME_OPTIONS = [
  "Reduce",
  "Reuse",
  "Recycle",
  "Recover",
  "Cleanfill",
  "Landfill",
] as const;
const INTENDED_OUTCOME_SET = new Set<string>(INTENDED_OUTCOME_OPTIONS);

export type WasteStreamPlanInput = {
  category: string;
  sub_material?: string | null;
  intended_outcomes: string[];
  /** Destination type: facility from catalog, or custom address. */
  destination_mode?: "facility" | "custom" | null;
  /** Partner (company) id from presets; null = Other/custom. */
  partner_id?: string | null;
  /** Facility (site) id from presets; null = use custom destination. */
  facility_id?: string | null;
  /** Custom destination text when partner is Other or no facility selected. */
  destination_override?: string | null;
  /** Custom destination display name (required when destination_mode === 'custom'). */
  custom_destination_name?: string | null;
  /** Custom destination address from Places (required when destination_mode === 'custom'). */
  custom_destination_address?: string | null;
  /** Google Place ID for custom destination. */
  custom_destination_place_id?: string | null;
  custom_destination_lat?: number | null;
  custom_destination_lng?: number | null;
  /** @deprecated Legacy; use partner_id + destination_override. */
  partner?: string | null;
  partner_overridden?: boolean;
  pathway: string;
  notes?: string | null;
  estimated_qty?: number | null;
  unit?: PlanUnit | null;
  /** Manual quantity converted to tonnes for reporting; set on save from estimated_qty + unit + density/thickness. */
  manual_qty_tonnes?: number | null;
  /** Override density (kg/m³) for conversion to tonnes. */
  density_kg_m3?: number | null;
  /** Override thickness (m) for m2 unit conversion. */
  thickness_m?: number | null;
  generated_by?: string | null;
  on_site_management?: string | null;
  /** @deprecated Legacy; use facility_id + destination_override. */
  destination?: string | null;
  distance_km?: number | null;
  /** Cached drive duration in minutes (from distance recompute). */
  duration_min?: number | null;
  /** Optional waste contractor (partner) override for this stream; null = use project primary. */
  waste_contractor_partner_id?: string | null;
  /** Forecast quantity for this stream (always tonnes). Stored in inputs JSON; RLS via swmp_inputs. */
  forecast_qty?: number | null;
  /** Unit for forecast_qty; always tonne for reporting. */
  forecast_unit?: string | null;
  /** Handling: mixed = co-mingled, separated = source-separated onsite. Default mixed. */
  handling_mode?: "mixed" | "separated" | null;
  /** Transient: set when loading legacy data with multiple intended_outcomes; not persisted. */
  hadMultipleOutcomes?: boolean;
};

// ---------------------------------------------------------------------------
// Unit defaults by stream label (pattern or key)
// ---------------------------------------------------------------------------

/** Default unit by stream label: soil/cleanfill/contaminated/green/insulation => m³, carpet => m², paints => L, else t */
export function getDefaultUnitForStream(stream: string): "t" | "m3" | "m2" | "L" {
  const lower = stream.toLowerCase();
  if (
    lower.includes("soil") ||
    lower.includes("cleanfill") ||
    lower.includes("contaminated") ||
    lower.includes("green waste") ||
    lower.includes("vegetation") ||
    lower.includes("insulation")
  )
    return "m3";
  if (lower.includes("carpet")) return "m2";
  if (lower.includes("paint") || lower.includes("adhesives") || lower.includes("chemicals"))
    return "L";
  return "t";
}

/** Map of stream label patterns to default unit (for reference / UI). */
export const WASTE_STREAM_UNIT_DEFAULTS: Record<string, "t" | "m3" | "m2" | "L"> = {
  "Soil / spoil (cleanfill if verified)": "m3",
  "Cleanfill soil": "m3",
  "Contaminated soil": "m3",
  "Green waste / vegetation": "m3",
  Insulation: "m3",
  "Carpet / carpet tiles": "m2",
  "Paints/adhesives/chemicals": "L",
  "Mixed C&D": "t",
  "Timber (untreated)": "t",
  "Timber (treated)": "t",
  "Plasterboard / GIB": "t",
  Metals: "t",
  "Concrete / masonry": "t",
  Cardboard: "t",
  "Soft plastics (wrap/strapping)": "t",
  "Hard plastics": "t",
  Glass: "t",
  "E-waste (cables/lighting/appliances)": "t",
  "Ceiling tiles": "t",
  "Asphalt / roading material": "t",
  "Concrete (reinforced)": "t",
  "Concrete (unreinforced)": "t",
  "Masonry / bricks": "t",
  "Roofing materials": "t",
  "Hazardous waste (general)": "t",
  "Packaging (mixed)": "t",
  "PVC pipes / services": "t",
  "HDPE pipes / services": "t",
};

// ---------------------------------------------------------------------------
// Default intended outcomes by stream (for templates)
// ---------------------------------------------------------------------------

export function getDefaultIntendedOutcomesForStream(stream: string): string[] {
  const lower = stream.toLowerCase();
  if (lower.includes("metal")) return ["Recycle"];
  if (lower.includes("cardboard")) return ["Recycle"];
  if (lower.includes("timber") && lower.includes("untreated")) return ["Reuse", "Recycle"];
  if (lower.includes("timber") && lower.includes("treated")) return ["Recover"];
  if (
    lower.includes("concrete") ||
    lower.includes("masonry") ||
    lower.includes("brick") ||
    lower.includes("asphalt") ||
    lower.includes("roading")
  )
    return ["Recycle", "Recover"];
  if (
    lower.includes("soil") ||
    lower.includes("cleanfill") ||
    (lower.includes("spoil") && lower.includes("cleanfill"))
  )
    return ["Cleanfill"];
  if (lower.includes("soft plastic") || lower.includes("wrap") || lower.includes("strapping"))
    return ["Recycle"];
  if (lower.includes("mixed c&d") || lower.includes("mixed c & d")) return ["Recover", "Landfill"];
  return ["Recycle"];
}

// ---------------------------------------------------------------------------
// Responsibilities and other sub-shapes
// ---------------------------------------------------------------------------

export type ResponsibilityInput = {
  role: string;
  party: string;
  responsibilities: string[];
};

export type AdditionalResponsibilityInput = {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  responsibilities: string;
};

export type HazardsInput = {
  asbestos: boolean;
  lead_paint: boolean;
  contaminated_soil: boolean;
};

export type LogisticsInput = {
  waste_contractor: string | null;
  bin_preference: "Recommend" | "Manual";
  reporting_cadence: "Weekly" | "Fortnightly" | "Monthly";
};

export type MonitoringInput = {
  methods: string[];
  uses_software: boolean;
  software_name: string | null;
  dockets_description: string;
};

export type SiteControlsInput = {
  bin_setup: string;
  signage_storage: string;
  contamination_controls: string;
  hazardous_controls: string;
};

export const DEFAULT_SITE_CONTROLS: SiteControlsInput = {
  bin_setup:
    "Dedicated bins/skips will be provided for key waste streams and positioned to suit workflow and access.",
  signage_storage:
    "Clear signage will be used at bin locations. Waste will be stored securely to prevent wind-blown litter and weather contamination.",
  contamination_controls:
    "Regular checks will be completed to prevent cross-contamination. Non-conforming loads will be re-sorted where practical.",
  hazardous_controls:
    "Hazardous materials will be separated, contained, and removed by approved operators with appropriate documentation.",
};

// ---------------------------------------------------------------------------
// Canonical SwmpInputs (persisted to swmp_inputs; project_id added at insert)
// ---------------------------------------------------------------------------

export const SORTING_LEVELS = ["Basic", "Moderate", "High"] as const;
export type SortingLevel = (typeof SORTING_LEVELS)[number];

export const DEFAULT_DOCKETS_DESCRIPTION =
  "All waste movements will be supported by weighbridge dockets and/or disposal receipts/invoices. These records will be retained as evidence of disposal pathway and used for SWMP reporting and diversion tracking.";

export type SwmpInputs = {
  project_id?: string;
  sorting_level: SortingLevel;
  target_diversion: number;
  constraints: string[];
  waste_streams: string[];
  waste_stream_plans: WasteStreamPlanInput[];
  hazards: HazardsInput;
  logistics: LogisticsInput;
  monitoring: MonitoringInput;
  site_controls: SiteControlsInput;
  responsibilities: ResponsibilityInput[];
  additional_responsibilities: AdditionalResponsibilityInput[];
  notes: string | null;
  /** Optional facility overrides (future use). */
  facility_overrides?: unknown;
};

// ---------------------------------------------------------------------------
// Default inputs
// ---------------------------------------------------------------------------

const DEFAULT_RESPONSIBILITIES: ResponsibilityInput[] = [
  {
    role: "SWMP Owner",
    party: "SWMP Owner",
    responsibilities: ["Maintain SWMP", "Coordinate waste streams and reporting", "Drive improvements"],
  },
  {
    role: "Main Contractor / Site Manager",
    party: "Main Contractor",
    responsibilities: ["Ensure segregation is followed", "Manage contamination", "Coordinate contractor"],
  },
  {
    role: "All trades",
    party: "Subcontractors",
    responsibilities: ["Follow segregation rules", "Keep areas tidy", "Report issues promptly"],
  },
];

export function defaultSwmpInputs(projectId?: string): SwmpInputs {
  const waste_streams = ["Mixed C&D"];
  return {
    ...(projectId != null ? { project_id: projectId } : {}),
    sorting_level: "Moderate",
    target_diversion: 70,
    constraints: [],
    waste_streams,
    waste_stream_plans: waste_streams.map((category) => ({
      category,
      sub_material: null,
      intended_outcomes: getDefaultIntendedOutcomesForStream(category),
      destination_mode: "facility",
      partner_id: null,
      facility_id: null,
      destination_override: null,
      custom_destination_name: null,
      custom_destination_address: null,
      custom_destination_place_id: null,
      custom_destination_lat: null,
      custom_destination_lng: null,
      partner: null,
      partner_overridden: false,
      pathway: `Segregate ${category} where practical and send to an approved recycler/processor.`,
      notes: null,
      estimated_qty: null,
      manual_qty_tonnes: null,
      unit: getDefaultUnitForStream(category),
      density_kg_m3: null,
      thickness_m: null,
      generated_by: null,
      on_site_management: null,
      destination: null,
      distance_km: null,
      duration_min: null,
      waste_contractor_partner_id: null,
      forecast_qty: null,
      forecast_unit: null,
      handling_mode: "mixed",
    })),
    hazards: { asbestos: false, lead_paint: false, contaminated_soil: false },
    logistics: {
      waste_contractor: null,
      bin_preference: "Recommend",
      reporting_cadence: "Weekly",
    },
    monitoring: {
      methods: ["Dockets"],
      uses_software: false,
      software_name: null,
      dockets_description: DEFAULT_DOCKETS_DESCRIPTION,
    },
    site_controls: { ...DEFAULT_SITE_CONTROLS },
    responsibilities: [...DEFAULT_RESPONSIBILITIES.map((r) => ({ ...r }))],
    additional_responsibilities: [],
    notes: null,
    facility_overrides: undefined,
  };
}

// ---------------------------------------------------------------------------
// Normalise a single waste stream plan (legacy outcome/outcomes, unit, qty)
// ---------------------------------------------------------------------------

function normalizeWasteStreamPlan(raw: unknown): WasteStreamPlanInput {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const category = String(p?.category ?? "").trim() || "Mixed C&D";

  const rawIntended = Array.isArray(p?.intended_outcomes)
    ? p.intended_outcomes
    : Array.isArray(p?.outcomes)
      ? p.outcomes
      : typeof p?.outcome === "string"
        ? [p.outcome]
        : [];
  const normalizeOutcome = (x: string) => {
    const v = String(x ?? "").trim();
    if (v === "Dispose") return "Landfill";
    if (v === "Clean fill") return "Cleanfill";
    return v;
  };
  const safeIntended = (rawIntended as string[])
    .map(normalizeOutcome)
    .filter((x) => INTENDED_OUTCOME_SET.has(x));
  const hadMultipleOutcomes = safeIntended.length > 1;
  const intended_outcomes =
    safeIntended.length > 0 ? (hadMultipleOutcomes ? [safeIntended[0]] : safeIntended) : ["Recycle"];

  const rawUnit = p?.unit;
  const unit: PlanUnit | null =
    rawUnit === "skip"
      ? "m2"
      : rawUnit === "load"
        ? "L"
        : rawUnit && VALID_UNITS.has(String(rawUnit))
          ? (String(rawUnit) as PlanUnit)
          : null;

  const estimated_qty =
    typeof p?.estimated_qty === "number" && !Number.isNaN(p.estimated_qty)
      ? p.estimated_qty
      : typeof (p as { estimated_quantity?: number }).estimated_quantity === "number"
        ? (p as { estimated_quantity: number }).estimated_quantity
        : null;

  const num = (x: unknown) => (typeof x === "number" && !Number.isNaN(x) ? x : null);
  const distance_km = num(p?.distance_km) != null && (num(p?.distance_km) as number) >= 0 ? (num(p?.distance_km) as number) : null;
  const density_kg_m3 = num(p?.density_kg_m3) != null && (num(p?.density_kg_m3) as number) > 0 ? (num(p?.density_kg_m3) as number) : null;
  const thickness_m = num(p?.thickness_m) != null && (num(p?.thickness_m) as number) >= 0 ? (num(p?.thickness_m) as number) : null;
  const forecast_qty = num(p?.forecast_qty) != null && (num(p?.forecast_qty) as number) >= 0 ? (num(p?.forecast_qty) as number) : null;
  const forecast_unit = (p?.forecast_unit != null && String(p.forecast_unit).trim()) ? String(p.forecast_unit).trim() : null;
  const manual_qty_tonnes = num(p?.manual_qty_tonnes) != null && (num(p?.manual_qty_tonnes) as number) >= 0 ? (num(p?.manual_qty_tonnes) as number) : null;

  const partner_id = p?.partner_id != null && String(p.partner_id).trim() ? String(p.partner_id).trim() : null;
  const facility_id = p?.facility_id != null && String(p.facility_id).trim() ? String(p.facility_id).trim() : null;
  // Backward compatible: if old destination text exists and no destination_override, map into destination_override
  const legacyDest = (p?.destination != null && String(p.destination).trim()) ? String(p.destination).trim() : null;
  const explicitOverride = (p?.destination_override != null && String(p.destination_override).trim()) ? String(p.destination_override).trim() : null;
  const destination_override = explicitOverride ?? legacyDest ?? null;

  const rawMode = p?.destination_mode;
  const hasCustomDest =
    (explicitOverride ?? legacyDest ?? "").trim() !== "" ||
    (p?.custom_destination_address != null && String(p.custom_destination_address).trim() !== "") ||
    (p?.custom_destination_place_id != null && String(p.custom_destination_place_id).trim() !== "");
  const destination_mode: "facility" | "custom" =
    rawMode === "custom"
      ? "custom"
      : rawMode === "facility"
        ? "facility"
        : facility_id != null && facility_id !== ""
          ? "facility"
          : hasCustomDest
            ? "custom"
            : "facility";
  const custom_destination_name = (p?.custom_destination_name != null && String(p.custom_destination_name).trim()) ? String(p.custom_destination_name).trim() : null;
  const custom_destination_address = (p?.custom_destination_address != null && String(p.custom_destination_address).trim()) ? String(p.custom_destination_address).trim() : null;
  const custom_destination_place_id = (p?.custom_destination_place_id != null && String(p.custom_destination_place_id).trim()) ? String(p.custom_destination_place_id).trim() : null;
  const custom_destination_lat = num(p?.custom_destination_lat) != null ? (num(p?.custom_destination_lat) as number) : null;
  const custom_destination_lng = num(p?.custom_destination_lng) != null ? (num(p?.custom_destination_lng) as number) : null;
  const duration_min = num(p?.duration_min) != null && (num(p?.duration_min) as number) >= 0 ? (num(p?.duration_min) as number) : null;

  return {
    category,
    sub_material: (p?.sub_material != null && String(p.sub_material).trim()) || null,
    intended_outcomes,
    ...(hadMultipleOutcomes ? { hadMultipleOutcomes: true } : {}),
    destination_mode,
    partner_id,
    facility_id,
    destination_override,
    custom_destination_name,
    custom_destination_address,
    custom_destination_place_id,
    custom_destination_lat,
    custom_destination_lng,
    partner: (p?.partner != null && String(p.partner).trim()) || null,
    partner_overridden: !!p?.partner_overridden,
    pathway:
      (p?.pathway != null && String(p.pathway).trim()) ||
      `Segregate ${category} where practical and send to an approved recycler/processor.`,
    notes: (p?.notes != null && String(p.notes).trim()) || null,
    estimated_qty: estimated_qty != null && estimated_qty >= 0 ? estimated_qty : null,
    unit,
    density_kg_m3,
    thickness_m,
    generated_by: (p?.generated_by != null && String(p.generated_by).trim()) || null,
    on_site_management: (p?.on_site_management != null && String(p.on_site_management).trim()) || null,
    destination: (p?.destination != null && String(p.destination).trim()) || null,
    distance_km,
    duration_min,
    waste_contractor_partner_id:
      p?.waste_contractor_partner_id != null && String(p.waste_contractor_partner_id).trim()
        ? String(p.waste_contractor_partner_id).trim()
        : null,
    forecast_qty: forecast_qty != null && forecast_qty >= 0 ? forecast_qty : null,
    forecast_unit: forecast_unit ?? null,
    manual_qty_tonnes: manual_qty_tonnes != null && manual_qty_tonnes >= 0 ? manual_qty_tonnes : null,
    handling_mode:
      p?.handling_mode === "separated" || p?.handling_mode === "mixed"
        ? p.handling_mode
        : "mixed",
  };
}

// ---------------------------------------------------------------------------
// Normalise full SwmpInputs from raw DB row or merged object
// ---------------------------------------------------------------------------

export function normalizeSwmpInputs(raw: unknown): SwmpInputs {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const project_id = r?.project_id != null ? String(r.project_id).trim() : undefined;

  const rawLevel = r?.sorting_level ?? "Moderate";
  const sorting_level: SortingLevel =
    rawLevel === "Medium" ? "Moderate" : SORTING_LEVELS.includes(rawLevel as SortingLevel) ? (rawLevel as SortingLevel) : "Moderate";

  const target_diversion =
    typeof r?.target_diversion === "number" && !Number.isNaN(r.target_diversion)
      ? Math.min(100, Math.max(0, Math.round(r.target_diversion)))
      : 70;

  const constraints = Array.isArray(r?.constraints)
    ? (r.constraints as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];

  const waste_streams = Array.isArray(r?.waste_streams)
    ? Array.from(new Set((r.waste_streams as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)))
    : ["Mixed C&D"];
  const safeWasteStreams = waste_streams.length > 0 ? waste_streams : ["Mixed C&D"];

  const rawPlans = Array.isArray(r?.waste_stream_plans) ? r.waste_stream_plans : [];
  const waste_stream_plans = (rawPlans as unknown[]).map(normalizeWasteStreamPlan);

  const hazardsRaw = r?.hazards && typeof r.hazards === "object" ? (r.hazards as Record<string, unknown>) : {};
  const hazards: HazardsInput = {
    asbestos: !!hazardsRaw?.asbestos,
    lead_paint: !!hazardsRaw?.lead_paint,
    contaminated_soil: !!hazardsRaw?.contaminated_soil,
  };

  const logisticsRaw = r?.logistics && typeof r.logistics === "object" ? (r.logistics as Record<string, unknown>) : {};
  const logistics: LogisticsInput = {
    waste_contractor: (logisticsRaw?.waste_contractor != null && String(logisticsRaw.waste_contractor).trim()) || null,
    bin_preference: logisticsRaw?.bin_preference === "Manual" ? "Manual" : "Recommend",
    reporting_cadence:
      logisticsRaw?.reporting_cadence === "Fortnightly"
        ? "Fortnightly"
        : logisticsRaw?.reporting_cadence === "Monthly"
          ? "Monthly"
          : "Weekly",
  };

  const monitoringRaw = r?.monitoring && typeof r.monitoring === "object" ? (r.monitoring as Record<string, unknown>) : {};
  const monitoring: MonitoringInput = {
    methods: Array.isArray(monitoringRaw?.methods) && monitoringRaw.methods.length > 0
      ? (monitoringRaw.methods as string[]).map((x) => String(x)).filter(Boolean)
      : ["Dockets"],
    uses_software: !!monitoringRaw?.uses_software,
    software_name: (monitoringRaw?.software_name != null && String(monitoringRaw.software_name).trim()) || null,
    dockets_description:
      (monitoringRaw?.dockets_description != null && String(monitoringRaw.dockets_description).trim()) ||
      DEFAULT_DOCKETS_DESCRIPTION,
  };

  const siteRaw = r?.site_controls && typeof r.site_controls === "object" ? (r.site_controls as Record<string, unknown>) : {};
  const site_controls: SiteControlsInput = {
    bin_setup: siteRaw?.bin_setup !== undefined && siteRaw?.bin_setup !== null ? String(siteRaw.bin_setup) : DEFAULT_SITE_CONTROLS.bin_setup,
    signage_storage: siteRaw?.signage_storage !== undefined && siteRaw?.signage_storage !== null ? String(siteRaw.signage_storage) : DEFAULT_SITE_CONTROLS.signage_storage,
    contamination_controls: siteRaw?.contamination_controls !== undefined && siteRaw?.contamination_controls !== null ? String(siteRaw.contamination_controls) : DEFAULT_SITE_CONTROLS.contamination_controls,
    hazardous_controls: siteRaw?.hazardous_controls !== undefined && siteRaw?.hazardous_controls !== null ? String(siteRaw.hazardous_controls) : DEFAULT_SITE_CONTROLS.hazardous_controls,
  };

  const rawResp = Array.isArray(r?.responsibilities) ? r.responsibilities : [];
  const mainResp = (rawResp as unknown[]).filter((x: unknown) => !(x && typeof x === "object" && (x as { __additional?: boolean }).__additional));
  const additionalFromResp = (rawResp as unknown[]).filter((x: unknown) => x && typeof x === "object" && (x as { __additional?: boolean }).__additional);
  const responsibilities: ResponsibilityInput[] =
    mainResp.length >= 3
      ? mainResp.slice(0, 3).map((x: unknown) => {
          const row = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
          return {
            role: String(row?.role ?? "").trim() || "Role",
            party: String(row?.party ?? "").trim() || "—",
            responsibilities: Array.isArray(row?.responsibilities)
              ? (row.responsibilities as unknown[]).map((v) => String(v ?? "").trim()).filter(Boolean)
              : [],
          };
        })
      : DEFAULT_RESPONSIBILITIES.map((r) => ({ ...r }));

  const additionalFromLegacy = Array.isArray(r?.additional_responsibilities) ? r.additional_responsibilities : [];
  const additionalMapped = (additionalFromResp.length > 0 ? additionalFromResp : additionalFromLegacy) as unknown[];
  const additional_responsibilities: AdditionalResponsibilityInput[] = additionalMapped
    .map((a: unknown) => {
      const row = a && typeof a === "object" ? (a as Record<string, unknown>) : {};
      const name = String(row?.name ?? "").trim();
      const role = String(row?.role ?? "").trim();
      const responsibilities = String(row?.responsibilities ?? "").trim();
      return { name, role, responsibilities, email: row?.email as string | undefined, phone: row?.phone as string | undefined };
    })
    .filter((a) => a.name || a.role || a.responsibilities);

  const notes = (r?.notes != null && String(r.notes).trim()) || null;
  const facility_overrides = r?.facility_overrides;

  return {
    ...(project_id ? { project_id } : {}),
    sorting_level,
    target_diversion,
    constraints,
    waste_streams: safeWasteStreams,
    waste_stream_plans,
    hazards,
    logistics,
    monitoring,
    site_controls,
    responsibilities,
    additional_responsibilities,
    notes,
    ...(facility_overrides !== undefined ? { facility_overrides } : {}),
  };
}
