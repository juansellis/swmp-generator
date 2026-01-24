import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";


export const SwmpWasteStreamRow = z.object({
  stream: z.string(),
  segregation_method: z.string(), // e.g. "Separate bin", "Bagged", "Residual"
  container: z.string(),          // e.g. "Timber skip", "Metals cage"
  handling_notes: z.string(),
  destination: z.string(),        // e.g. "Approved recycler / transfer station"
});

export const SwmpRoleRow = z.object({
  role: z.string(),              // e.g. "SWMP Owner", "Site Manager"
  name_or_party: z.string(),      // e.g. "Main contractor" or person
  responsibilities: z.array(z.string()).min(1),
});

export const SwmpChecklistItem = z.object({
  item: z.string(),
  frequency: z.string(),          // e.g. "Weekly", "Daily", "Fortnightly"
  owner: z.string(),              // e.g. "Site Manager"
});

export const SwmpSchema = z.object({
  title: z.string(),
  prepared_for: z.string(),
  prepared_by: z.string(),
  date_prepared: z.string(), // ISO date string preferred

  project_overview: z.object({
    project_name: z.string(),
    address: z.string(),
    region: z.string(),
    project_type: z.string(),
    programme: z.string(), // e.g. "Start: ... End: ..."
    site_constraints: z.array(z.string()),
  }),

  objectives: z.object({
    diversion_target_percent: z.number().min(0).max(100),
    primary_objectives: z.array(z.string()).min(3),
  }),

  roles_and_responsibilities: z.array(SwmpRoleRow).min(3),

  waste_streams: z.array(SwmpWasteStreamRow).min(4),

  onsite_separation_plan: z.object({
    bin_setup_recommendation: z.array(z.string()).min(2),
    signage_and_storage: z.array(z.string()).min(3),
    contamination_controls: z.array(z.string()).min(4),
  }),

  regulated_and_hazardous: z.object({
    flags: z.object({
      asbestos: z.boolean(),
      lead_paint: z.boolean(),
      contaminated_soil: z.boolean(),
    }),
    controls: z.array(z.string()).min(2),
  }),

  training_and_comms: z.object({
    induction_points: z.array(z.string()).min(3),
    toolbox_talk_topics: z.array(z.string()).min(3),
  }),

  monitoring_and_reporting: z.object({
    reporting_cadence: z.string(),
    checklists: z.array(SwmpChecklistItem).min(3),
    corrective_actions: z.array(z.string()).min(3),
    evidence_to_keep: z.array(z.string()).min(3),
  }),

  assumptions: z.array(z.string()).min(1),
});

export type Swmp = z.infer<typeof SwmpSchema>;

export const SwmpJsonSchema = zodToJsonSchema(SwmpSchema as any, "swmp");
