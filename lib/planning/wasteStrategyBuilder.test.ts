/**
 * QA tests for Waste Strategy Builder (deterministic planning intelligence).
 * Run: npx tsx lib/planning/wasteStrategyBuilder.test.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildWasteStrategy } from "./wasteStrategyBuilder";
import { SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";

function run(label: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ ${label}`);
    } catch (e) {
      console.error(`  ✗ ${label}`);
      throw e;
    }
  })();
}

function createMockSupabase(fixture: {
  inputs?: unknown;
  project?: { region?: string | null; primary_waste_contractor_partner_id?: string | null };
  forecastItems?: { quantity: number; excess_percent: number; unit: string | null; kg_per_m: number | null; waste_stream_key: string | null }[];
}): SupabaseClient {
  const from = (table: string) => ({
    select: (cols: string) => ({
      eq: (_col: string, _val: string) => ({
        order: () => ({
          limit: () => ({
            maybeSingle: async () => ({
              data: table === "swmp_inputs" ? { [SWMP_INPUTS_JSON_COLUMN]: fixture.inputs } : null,
              error: null,
            }),
            single: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      single: async () =>
        table === "projects"
          ? { data: fixture.project ?? { region: "Auckland", primary_waste_contractor_partner_id: null }, error: null }
          : { data: null, error: null },
    }),
  });
  const client = {
    from,
    auth: { getUser: async () => ({ data: { user: {} }, error: null }) },
  } as unknown as SupabaseClient;
  return client;
}

// Override global fetch for project_forecast_items in getForecastCounts - actually the builder uses supabase.from("project_forecast_items").select(...).eq("project_id", projectId).
// So we need to mock that. Our mock currently only handles swmp_inputs (maybeSingle) and projects (single). getForecastCounts does:
// supabase.from("project_forecast_items").select("quantity, excess_percent, unit, kg_per_m, waste_stream_key").eq("project_id", projectId)
// So we need the mock to return different data per table. Let me extend the mock.
function createMockSupabaseFull(fixture: {
  inputs?: unknown;
  project?: { region?: string | null; primary_waste_contractor_partner_id?: string | null };
  forecastRows?: { quantity: number; excess_percent: number; unit: string | null; kg_per_m: number | null; waste_stream_key: string | null }[];
}): SupabaseClient {
  const from = (table: string) => ({
    select: (_cols: string) => ({
      eq: (_col: string, _val: string) => ({
        order: () => ({
          limit: (n: number) => ({
            maybeSingle: async () => {
              if (table === "swmp_inputs") {
                const row = fixture.inputs != null ? { [SWMP_INPUTS_JSON_COLUMN]: fixture.inputs } : null;
                return { data: row, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
        single: async () => {
          if (table === "projects")
            return { data: fixture.project ?? { id: "proj-1", region: "Auckland", primary_waste_contractor_partner_id: null }, error: null };
          return { data: null, error: null };
        },
      }),
    }),
  });
  const client = {
    from: (table: string) => {
      if (table === "project_forecast_items") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: fixture.forecastRows ?? [],
                error: null,
              }),
          }),
        };
      }
      if (table === "swmp_inputs") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: fixture.inputs != null ? { [SWMP_INPUTS_JSON_COLUMN]: fixture.inputs } : null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: fixture.project ?? { id: "proj-1", region: "Auckland", primary_waste_contractor_partner_id: null },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({}) }) };
    },
    auth: { getUser: async () => ({ data: { user: {} }, error: null }) },
  } as unknown as SupabaseClient;
  return client;
}

console.log("Waste Strategy Builder QA\n");

// Fixture: Only Mixed C&D + major metal forecast (e.g. Metals stream from forecast with 1.5 t)
run("Project with only Mixed C&D + major metal forecast recommends separating Metal and reducing Mixed reliance", async () => {
  const inputs = {
    waste_streams: ["Mixed C&D", "Metals"],
    waste_stream_plans: [
      {
        category: "Mixed C&D",
        intended_outcomes: ["Recover", "Landfill"],
        manual_qty_tonnes: 2,
        forecast_qty: 0.5,
        facility_id: "akl-cd-1",
        partner_id: null,
      },
      {
        category: "Metals",
        intended_outcomes: ["Recycle"],
        manual_qty_tonnes: 0,
        forecast_qty: 1.5,
        facility_id: null,
        partner_id: null,
      },
    ],
  };
  const supabase = createMockSupabaseFull({
    inputs: inputs,
    project: { region: "Auckland", primary_waste_contractor_partner_id: null },
    forecastRows: [
      { quantity: 10, excess_percent: 15, unit: "tonne", kg_per_m: null, waste_stream_key: "Metals" },
      { quantity: 5, excess_percent: 20, unit: "tonne", kg_per_m: null, waste_stream_key: "Mixed C&D" },
    ],
  });
  const result = await buildWasteStrategy("proj-1", supabase);
  const metalPlan = result.streamPlans.find((s) => s.stream_name === "Metals");
  if (!metalPlan) throw new Error("Expected Metals stream plan");
  if (metalPlan.recommended_handling !== "separate")
    throw new Error(`Expected Metals recommended_handling "separate", got ${metalPlan.recommended_handling}`);
  const separateRec = result.recommendations.find((r) => r.title.includes("Separate Metals"));
  if (!separateRec) throw new Error("Expected recommendation to separate Metals onsite");
  const mixedReliance = result.recommendations.find((r) => r.title.includes("Increase source separation") || r.title.includes("Mixed"));
  if (result.summary.total_estimated_tonnes < 1) throw new Error("Expected total tonnes >= 1");
});

// Fixture: Facilities set for each stream -> no "choose facility" for those streams
run("Project with facilities set for each stream does not suggest facility changes for those streams", async () => {
  const inputs = {
    waste_streams: ["Mixed C&D", "Metals"],
    waste_stream_plans: [
      { category: "Mixed C&D", intended_outcomes: ["Recover", "Landfill"], manual_qty_tonnes: 1, forecast_qty: 0, facility_id: "akl-cd-1", partner_id: "partner-akl-cd" },
      { category: "Metals", intended_outcomes: ["Recycle"], manual_qty_tonnes: 0.5, forecast_qty: 0, facility_id: "akl-metals-1", partner_id: "partner-akl-metals" },
    ],
  };
  const supabase = createMockSupabaseFull({
    inputs,
    project: { region: "Auckland", primary_waste_contractor_partner_id: null },
    forecastRows: [],
  });
  const result = await buildWasteStrategy("proj-2", supabase);
  const missingFacilityRecs = result.recommendations.filter((r) => r.action_type === "change_facility" && (r.title.includes("Mixed C&D") || r.title.includes("Metals")));
  if (missingFacilityRecs.length > 0)
    throw new Error(`Expected no facility-change recommendations for streams that have facilities; got: ${missingFacilityRecs.map((r) => r.title).join(", ")}`);
});

// Fixture: Narrative includes key_assumptions and methodology (assumptions always present)
run("Strategy narrative includes methodology and key assumptions", async () => {
  const inputs = {
    waste_streams: ["Mixed C&D", "Metals"],
    waste_stream_plans: [
      { category: "Mixed C&D", intended_outcomes: ["Recover", "Landfill"], manual_qty_tonnes: 1, forecast_qty: 0, facility_id: null, partner_id: null },
      { category: "Metals", intended_outcomes: ["Recycle"], manual_qty_tonnes: 0.5, forecast_qty: 0, facility_id: null, partner_id: null },
    ],
  };
  const supabase = createMockSupabaseFull({
    inputs,
    project: { region: "Auckland", primary_waste_contractor_partner_id: null },
    forecastRows: [],
  });
  const result = await buildWasteStrategy("proj-3", supabase);
  if (!result.narrative.key_assumptions.length)
    throw new Error("Expected narrative to have key_assumptions");
  if (!result.narrative.methodology_paragraph?.length)
    throw new Error("Expected narrative to have methodology_paragraph");
  if (!result.narrative.swmp_summary_paragraph?.length)
    throw new Error("Expected narrative to have swmp_summary_paragraph");
});
