import { z } from "zod";

// -------------------------------
// Core enums + helpers
// -------------------------------

export const OutcomeEnum = z.enum(["Reuse", "Recycle", "Cleanfill", "Landfill"]);
export type Outcome = z.infer<typeof OutcomeEnum>;

export const IntendedOutcomeEnum = z.enum([
  "Reduce",
  "Reuse",
  "Recycle",
  "Recover",
  "Cleanfill",
  "Landfill",
]);
export type IntendedOutcome = z.infer<typeof IntendedOutcomeEnum>;

export const MonitoringMethodEnum = z.enum([
  "Dockets",
  "Invoices/receipts",
  "Photos",
  "Monthly reporting",
  "Toolbox talks",
]);

function normalizeOutcomeValue(x: unknown): string {
  const s = String(x ?? "").trim();
  if (s === "Dispose") return "Landfill";
  if (s === "Recover") return "Recycle";
  if (s === "Clean fill") return "Cleanfill";
  return s;
}

// -------------------------------
// Sub-schemas
// -------------------------------

export const BrandingSchema = z.object({
  org_name: z.string().optional().nullable(),
  org_logo_url: z.string().optional().nullable(),
  client_name: z.string().optional().nullable(),
  client_logo_url: z.string().optional().nullable(),
  brand_primary: z.string().optional().nullable(),
  brand_secondary: z.string().optional().nullable(),
});

export const ProjectDetailsSchema = z.object({
  project_name: z.string().min(1),
  site_address: z.string().min(1),
  region: z.string().min(1),
  project_type: z.string().min(1),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  main_contractor: z.string().min(1),
  swmp_owner: z.string().min(1),
});

export const ResponsibilitySchema = z.object({
  role: z.string().min(1),
  party: z.string().min(1),
  responsibilities: z.array(z.string()).min(1),
});

// Accept legacy outcome/outcomes and normalize to intended_outcomes.
// Legacy unit "skip" -> "m2", "load" -> "L" for backward compatibility.
function normalizeToIntendedOutcomes(val: unknown): string[] {
  if (Array.isArray(val)) {
    const allowed = new Set(["Reduce", "Reuse", "Recycle", "Recover", "Cleanfill", "Landfill"]);
    return (val as any[])
      .map((x) => {
        const s = String(x ?? "").trim();
        if (s === "Dispose") return "Landfill";
        if (s === "Recover") return "Recover";
        if (s === "Clean fill") return "Cleanfill";
        return s;
      })
      .filter((s) => allowed.has(s));
  }
  if (typeof val === "string" && val.trim()) {
    const s = val.trim();
    if (s === "Dispose") return ["Landfill"];
    if (s === "Recover") return ["Recover"];
    if (s === "Clean fill") return ["Cleanfill"];
    if (["Reduce", "Reuse", "Recycle", "Recover", "Cleanfill", "Landfill"].includes(s))
      return [s];
  }
  return [];
}

export const WasteStreamPlanSchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return val;
  const v = val as any;

  if (!Array.isArray(v.intended_outcomes)) {
    const rawOutcomes = Array.isArray(v.outcomes)
      ? v.outcomes
      : typeof v.outcome === "string"
        ? [v.outcome]
        : [];
    v.intended_outcomes = normalizeToIntendedOutcomes(rawOutcomes).length
      ? normalizeToIntendedOutcomes(rawOutcomes)
      : ["Recycle"];
  }

  // Normalize quantity: accept estimated_quantity or estimated_qty
  if (v.estimated_qty == null && typeof v.estimated_quantity === "number") {
    v.estimated_qty = v.estimated_quantity;
  }

  // Normalize unit: legacy skip -> m2, load -> L
  if (v.unit === "skip") v.unit = "m2";
  if (v.unit === "load") v.unit = "L";

  return v;
}, z.object({
  category: z.string().min(1),
  sub_material: z.string().optional().nullable(),
  intended_outcomes: z.array(IntendedOutcomeEnum).min(1),
  partner_id: z.string().optional().nullable(),
  facility_id: z.string().optional().nullable(),
  destination_override: z.string().optional().nullable(),
  partner: z.string().optional().nullable(),
  partner_overridden: z.boolean().optional().default(false),
  pathway: z.string().min(1),
  notes: z.string().optional().nullable(),
  estimated_qty: z.number().min(0).optional().nullable(),
  unit: z.enum(["kg", "t", "m3", "m2", "L"]).optional().nullable(),
  density_kg_m3: z.number().min(0).optional().nullable(),
  thickness_m: z.number().min(0).optional().nullable(),
  manual_qty_tonnes: z.number().min(0).optional().nullable(),
  forecast_qty: z.number().min(0).optional().nullable(),
  forecast_unit: z.string().optional().nullable(),
  generated_by: z.string().optional().nullable(),
  on_site_management: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
  distance_km: z.number().min(0).optional().nullable(),
}));

export const WasteStreamRowSchema = z.object({
  stream: z.string().min(1),
  segregation_method: z.string().min(1),
  container: z.string().min(1),
  handling_notes: z.string().min(1),
  destination: z.string().min(1),
});

export const MonitoringSchema = z.object({
  methods: z.array(MonitoringMethodEnum).default(["Dockets"]),
  uses_software: z.boolean().default(false),
  software_name: z.string().optional().nullable(),
  dockets_description: z.string().optional().nullable(),
});

export const OnSiteControlsSchema = z.object({
  bin_setup: z.array(z.string()).min(2),
  signage_and_storage: z.array(z.string()).min(2),
  contamination_controls: z.array(z.string()).min(3),
  hazardous_controls: z.array(z.string()).min(2),
});

export const RecordsAndEvidenceSchema = z.object({
  evidence_methods: z.array(z.string()).min(1),
  record_retention: z.array(z.string()).min(1),
  reporting_cadence: z.string().min(1),
  notes: z.string().optional().nullable(),
});

// -------------------------------
// Comprehensive SWMP schema (output)
// -------------------------------

export const SwmpSchema = z.object({
  report_title: z.string().min(1),
  date_prepared: z.string().min(1),
  footer_text: z.string().default(""),

  branding: BrandingSchema,
  project: ProjectDetailsSchema,

  objectives: z.object({
    diversion_target_percent: z.number().min(0).max(100),
    primary_objectives: z.array(z.string()).min(3),
  }),

  responsibilities: z.array(ResponsibilitySchema).min(3),

  waste_streams: z.array(WasteStreamRowSchema).min(4),
  waste_stream_plans: z.array(WasteStreamPlanSchema).default([]),

  monitoring: MonitoringSchema,
  on_site_controls: OnSiteControlsSchema,
  records_and_evidence: RecordsAndEvidenceSchema,

  assumptions: z.array(z.string()).min(1),
});

export type Swmp = z.infer<typeof SwmpSchema>;

