import { z } from "zod";

// -------------------------------
// Core enums + helpers
// -------------------------------

export const OutcomeEnum = z.enum(["Reuse", "Recycle", "Cleanfill", "Landfill"]);
export type Outcome = z.infer<typeof OutcomeEnum>;

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

// Accept both legacy `outcome: string` and new `outcomes: string[]` and normalize.
export const WasteStreamPlanSchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return val;
  const v = val as any;

  if (!Array.isArray(v.outcomes) && typeof v.outcome === "string") {
    v.outcomes = [v.outcome];
  }

  if (Array.isArray(v.outcomes)) {
    v.outcomes = v.outcomes.map(normalizeOutcomeValue);
  }

  return v;
}, z.object({
  category: z.string().min(1),
  sub_material: z.string().optional().nullable(),
  outcomes: z.array(OutcomeEnum).min(1),
  partner: z.string().optional().nullable(),
  partner_overridden: z.boolean().optional().default(false),
  pathway: z.string().min(1),
  notes: z.string().optional().nullable(),
  estimated_qty: z.number().optional().nullable(),
  unit: z.enum(["kg", "t", "m3", "skip", "load"]).optional().nullable(),
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

