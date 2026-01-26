// app/api/generate-swmp/route.ts
//
// Build-safe: does NOT require OPENAI_API_KEY when MOCK_SWMP=1.
// When MOCK_SWMP=0, it will require OPENAI_API_KEY and run a real OpenAI call.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SwmpSchema } from "@/lib/swmpSchema";
import { renderSwmpHtml } from "@/lib/renderSwmp";

export const runtime = "nodejs"; // ensure Node runtime for OpenAI SDK

export async function POST(req: Request) {
  try {
    const MOCK_SWMP = process.env.MOCK_SWMP === "1";

    const body = await req.json().catch(() => ({}));
    const project_id = String(body?.project_id ?? "").trim();

    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    // 1) Fetch project
    const { data: project, error: projectErr } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (projectErr || !project) {
      return NextResponse.json(
        { error: projectErr?.message ?? "Project not found" },
        { status: 404 }
      );
    }

    // 2) Fetch latest inputs
    const { data: inputs, error: inputsErr } = await supabaseAdmin
      .from("swmp_inputs")
      .select("*")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (inputsErr || !inputs) {
      return NextResponse.json(
        { error: inputsErr?.message ?? "No SWMP inputs found for project" },
        { status: 404 }
      );
    }

    // Fetch org branding (if available) via org_members
    let orgBrand: any = null;
    if ((project as any).user_id) {
      // Get org for the project's user via org_members
      const { data: member } = await supabaseAdmin
        .from("org_members")
        .select("org_id")
        .eq("user_id", (project as any).user_id)
        .limit(1)
        .maybeSingle();

      if (member?.org_id) {
        const { data: org } = await supabaseAdmin
          .from("orgs")
          .select(
            "name, logo_url, brand_primary, brand_primary_colour, brand_secondary, footer_text, contact_email, contact_phone, website"
          )
          .eq("id", member.org_id)
          .maybeSingle();

        if (org) {
          // Support both brand_primary and brand_primary_colour for backwards compatibility
          orgBrand = {
            ...org,
            brand_primary: org.brand_primary_colour ?? org.brand_primary ?? null,
          };
        }
      }
    }

    // Ensure we always have >= 4 streams to satisfy SwmpSchema.min(4)
    // (users may select fewer streams in the UI)
    const ensuredWasteStreams = (() => {
      const selected = Array.isArray((inputs as any).waste_streams)
        ? (inputs as any).waste_streams.map((x: any) => String(x)).filter(Boolean)
        : [];

      const unique = Array.from(new Set(selected));
      const defaults = [
        "Mixed C&D",
        "Timber (untreated)",
        "Metals",
        "Cardboard",
        "Plasterboard / GIB",
        "Concrete / masonry",
      ];

      for (const d of defaults) {
        if (unique.length >= 4) break;
        if (!unique.includes(d)) unique.push(d);
      }

      // As a final fallback, pad with generic streams.
      while (unique.length < 4) {
        unique.push(`Other stream ${unique.length + 1}`);
      }

      return unique;
    })();

    // Normalize waste stream plans to the new schema shape (outcomes[])
    const ensuredWasteStreamPlans = (() => {
      const raw = Array.isArray((inputs as any).waste_stream_plans)
        ? (inputs as any).waste_stream_plans
        : [];

      return raw.map((p: any) => {
        const rawOutcomes = Array.isArray(p?.outcomes)
          ? p.outcomes
          : typeof p?.outcome === "string"
            ? [p.outcome]
            : ["Recycle"];

        const mapOutcome = (x: any) => {
          const s = String(x ?? "").trim();
          if (s === "Dispose") return "Landfill";
          if (s === "Recover") return "Recycle";
          if (s === "Clean fill") return "Cleanfill";
          return s;
        };

        const outcomes = rawOutcomes.map(mapOutcome);

        return {
          ...p,
          outcomes,
        };
      });
    })();

    // 3) Determine next version number
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("swmps")
      .select("version")
      .eq("project_id", project_id)
      .order("version", { ascending: false })
      .limit(1);

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    const nextVersion = (existing?.[0]?.version ?? 0) + 1;

    const reportTitle =
      String((project as any).report_title ?? "").trim() ||
      "Site Waste Management Plan (SWMP)";

    const footerText =
      String((project as any).report_footer_override ?? "").trim() ||
      String(orgBrand?.footer_text ?? "").trim() ||
      "";

    // Build context payload for the model (and for mock)
    const context = {
      branding: {
        org_name: orgBrand?.name ?? null,
        org_logo_url: orgBrand?.logo_url ?? null,
        brand_primary: orgBrand?.brand_primary ?? null,
        brand_secondary: orgBrand?.brand_secondary ?? null,
        client_name: (project as any).client_name ?? null,
        client_logo_url: (project as any).client_logo_url ?? null,
      },
      project: {
        project_name: project.name,
        site_address: (project as any).site_address ?? project.address ?? "",
        region: project.region ?? "Other (NZ)",
        project_type: project.project_type ?? "Construction project",
        start_date: project.start_date ?? null,
        end_date: project.end_date ?? null,
        main_contractor: project.main_contractor ?? "",
        swmp_owner: project.swmp_owner ?? "",
      },
      inputs: {
        sorting_level: (inputs as any).sorting_level ?? null,
        target_diversion: (inputs as any).target_diversion ?? null,
        constraints: (inputs as any).constraints ?? [],
        waste_streams: ensuredWasteStreams,
        waste_stream_plans: ensuredWasteStreamPlans,
        monitoring: (inputs as any).monitoring ?? null,
        logistics: (inputs as any).logistics ?? null,
        notes: (inputs as any).notes ?? null,
        hazards: (inputs as any).hazards ?? null,
      },
      report: {
        report_title: reportTitle,
        footer_text: footerText,
      },
    };

    // 4) Generate SWMP (Mock or Real)
    let swmp: any;

    if (MOCK_SWMP) {
      const today = new Date().toISOString().slice(0, 10);

      swmp = SwmpSchema.parse({
        report_title: reportTitle,
        date_prepared: today,
        footer_text: footerText,
        branding: context.branding,
        project: context.project,
        objectives: {
          diversion_target_percent: Number((inputs as any).target_diversion ?? 70),
          primary_objectives: [
            "Maximise diversion of recoverable materials via on-site separation where practical.",
            "Minimise contamination through clear signage, storage controls, and trade engagement.",
            "Maintain auditable records (dockets/receipts/photos) and report performance regularly.",
          ],
        },
        responsibilities: [
          {
            role: "SWMP Owner",
            party: context.project.swmp_owner || "SWMP Owner",
            responsibilities: ["Maintain SWMP", "Coordinate waste streams and reporting", "Drive improvements"],
          },
          {
            role: "Main Contractor / Site Manager",
            party: context.project.main_contractor || "Main Contractor",
            responsibilities: ["Ensure segregation is followed", "Manage contamination", "Coordinate contractor"],
          },
          {
            role: "All trades",
            party: "Subcontractors",
            responsibilities: ["Follow segregation rules", "Keep areas tidy", "Report issues promptly"],
          },
        ],
        waste_streams: ensuredWasteStreams.map((s: any) => ({
          stream: String(s),
          segregation_method: "Separate where practical",
          container: "Skip / cage as allocated",
          handling_notes: "Keep dry/clean, avoid contamination.",
          destination: "Approved recycler / transfer station",
        })),
        waste_stream_plans: ensuredWasteStreamPlans,
        monitoring: {
          methods: (context.inputs.monitoring?.methods ?? ["Dockets"]) as any,
          uses_software: !!context.inputs.monitoring?.uses_software,
          software_name: context.inputs.monitoring?.software_name ?? null,
          dockets_description: context.inputs.monitoring?.dockets_description ?? footerText ?? null,
        },
        on_site_controls: {
          bin_setup: [
            "Provide dedicated skips/cages for key streams where feasible.",
            "Locate bins close to workfaces where safe to reduce contamination.",
          ],
          signage_and_storage: [
            "Install clear signage with examples for each stream.",
            "Keep cardboard/plasterboard dry (covered storage).",
          ],
          contamination_controls: [
            "Weekly inspections and contamination spot checks.",
            "Remove contaminants immediately and brief responsible trade.",
            "Minimise mixed waste by improving bin placement/signage.",
          ],
          hazardous_controls: [
            "Segregate regulated materials and use licensed contractors where required.",
            "Retain disposal documentation and approvals (e.g. cleanfill acceptance).",
          ],
        },
        records_and_evidence: {
          evidence_methods: Array.isArray(context.inputs.monitoring?.methods)
            ? context.inputs.monitoring.methods
            : ["Dockets"],
          record_retention: [
            "Weighbridge dockets / disposal receipts / invoices",
            "Photos of bins and signage",
            "Monthly summaries and corrective action notes",
          ],
          reporting_cadence: String((inputs as any).logistics?.reporting_cadence ?? "Monthly"),
          notes: context.inputs.monitoring?.dockets_description ?? null,
        },
        assumptions: [
          "Final bin configuration and waste contractor details to be confirmed at site establishment.",
        ],
      });
    } else {
      // Real OpenAI path (only runs when MOCK_SWMP=0)
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(
          { error: "OPENAI_API_KEY is missing (set it in environment variables)." },
          { status: 500 }
        );
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const instructions = `
You are a New Zealand construction waste specialist. Produce a practical, NZ-first Site Waste Management Plan (SWMP) that is site-usable.

Use NZ terminology (skip, transfer station, cleanfill, weighbridge dockets, toolbox talks).
Avoid generic fluff. If details are missing, make reasonable assumptions and list them in assumptions.
Output must follow the provided schema exactly.
`;

      const response = await openai.responses.parse({
        model: "gpt-4o-mini",
        instructions,
        input: JSON.stringify(context),
        text: {
          format: zodTextFormat(SwmpSchema, "swmp"),
        },
      });

      swmp = response.output_parsed;

      if (!swmp) {
        return NextResponse.json({ error: "No parsed SWMP returned by model." }, { status: 500 });
      }
    }

    // Validate against schema (defensive)
    swmp = SwmpSchema.parse(swmp);

    // 5) Render HTML for viewing/export (deterministic renderer uses swmp.branding/footer_text)
    const html = renderSwmpHtml(swmp);

    // 6) Save SWMP record
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("swmps")
      .insert({
        project_id,
        version: nextVersion,
        content_json: swmp,
        content_html: html,
      })
      .select("id, version")
      .single();

    if (saveErr || !saved) {
      return NextResponse.json({ error: saveErr?.message ?? "Failed to save SWMP" }, { status: 500 });
    }

    return NextResponse.json({ swmp_id: saved.id, version: saved.version });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
