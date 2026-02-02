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
import {
  normalizeSwmpInputs,
  SWMP_INPUTS_JSON_COLUMN,
  type SiteControlsInput,
} from "@/lib/swmp/schema";

/** Build on_site_controls arrays from inputs; pad to meet schema min lengths (2,2,3,2). */
function buildOnSiteControlsFromInputs(sc: SiteControlsInput | undefined) {
  const raw: Partial<SiteControlsInput> = sc ?? {};
  const toArr = (s: string | undefined) =>
    (s ?? "").trim()
      ? (String(s).trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
      : ["—"];
  const pad = (arr: string[], min: number) =>
    arr.length >= min ? arr : [...arr, ...Array.from({ length: min - arr.length }, () => "—")];
  return {
    bin_setup: pad(toArr(raw.bin_setup), 2),
    signage_and_storage: pad(toArr(raw.signage_storage), 2),
    contamination_controls: pad(toArr(raw.contamination_controls), 3),
    hazardous_controls: pad(toArr(raw.hazardous_controls), 2),
  };
}

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

    const jsonCol = (inputs as Record<string, unknown>)[SWMP_INPUTS_JSON_COLUMN];
    const rawInputs =
      jsonCol != null && typeof jsonCol === "object"
        ? { ...(jsonCol as Record<string, unknown>), project_id }
        : { project_id };
    const normalizedInputs = normalizeSwmpInputs(rawInputs);

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
    const ensuredWasteStreams = (() => {
      const selected = [...normalizedInputs.waste_streams];
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
      while (unique.length < 4) {
        unique.push(`Other stream ${unique.length + 1}`);
      }
      return unique;
    })();

    const ensuredWasteStreamPlans = normalizedInputs.waste_stream_plans;

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
        sorting_level: normalizedInputs.sorting_level,
        target_diversion: normalizedInputs.target_diversion,
        constraints: normalizedInputs.constraints,
        waste_streams: ensuredWasteStreams,
        waste_stream_plans: ensuredWasteStreamPlans,
        monitoring: normalizedInputs.monitoring,
        logistics: normalizedInputs.logistics,
        notes: normalizedInputs.notes,
        hazards: normalizedInputs.hazards,
        responsibilities: [
          ...normalizedInputs.responsibilities,
          ...normalizedInputs.additional_responsibilities.map((a) => ({
            __additional: true,
            ...a,
          })),
        ],
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
          diversion_target_percent: Number(normalizedInputs.target_diversion ?? 70),
          primary_objectives: [
            "Maximise diversion of recoverable materials via on-site separation where practical.",
            "Minimise contamination through clear signage, storage controls, and trade engagement.",
            "Maintain auditable records (dockets/receipts/photos) and report performance regularly.",
          ],
        },
        responsibilities: (() => {
          const raw = context.inputs.responsibilities;
          if (Array.isArray(raw) && raw.length >= 3) {
            return raw.slice(0, 3).map((r: any) => ({
              role: String(r?.role ?? "").trim() || "Role",
              party: String(r?.party ?? "").trim() || "—",
              responsibilities: Array.isArray(r?.responsibilities) && r.responsibilities.length > 0
                ? r.responsibilities.map((x: any) => String(x ?? "").trim()).filter(Boolean)
                : ["—"],
            }));
          }
          return [
            { role: "SWMP Owner", party: context.project.swmp_owner || "SWMP Owner", responsibilities: ["Maintain SWMP", "Coordinate waste streams and reporting", "Drive improvements"] },
            { role: "Main Contractor / Site Manager", party: context.project.main_contractor || "Main Contractor", responsibilities: ["Ensure segregation is followed", "Manage contamination", "Coordinate contractor"] },
            { role: "All trades", party: "Subcontractors", responsibilities: ["Follow segregation rules", "Keep areas tidy", "Report issues promptly"] },
          ];
        })(),
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
        on_site_controls: buildOnSiteControlsFromInputs(normalizedInputs.site_controls),
        records_and_evidence: {
          evidence_methods: Array.isArray(context.inputs.monitoring?.methods)
            ? context.inputs.monitoring.methods
            : ["Dockets"],
          record_retention: [
            "Weighbridge dockets / disposal receipts / invoices",
            "Photos of bins and signage",
            "Monthly summaries and corrective action notes",
          ],
          reporting_cadence: String(normalizedInputs.logistics?.reporting_cadence ?? "Monthly"),
          notes: normalizedInputs.notes ?? null,
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

    // Overlay saved inputs so report reflects user data (notes, responsibilities)
    if (normalizedInputs.notes != null && normalizedInputs.notes.trim() !== "") {
      swmp.records_and_evidence = swmp.records_and_evidence ?? {};
      swmp.records_and_evidence.notes = normalizedInputs.notes.trim();
    }
    if (normalizedInputs.responsibilities.length >= 3) {
      swmp.responsibilities = normalizedInputs.responsibilities.slice(0, 3).map((r) => ({
        role: r.role.trim() || "Role",
        party: r.party.trim() || "—",
        responsibilities: r.responsibilities.length ? r.responsibilities : ["—"],
      }));
    }
    if (normalizedInputs.additional_responsibilities.length > 0) {
      const extra = normalizedInputs.additional_responsibilities
        .filter((a) => a.name.trim() || a.role.trim() || a.responsibilities.trim())
        .map((a) => ({
          role: a.role.trim() || "—",
          party: a.name.trim() || "—",
          responsibilities: a.responsibilities
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean),
        }));
      if (extra.length) {
        swmp.responsibilities = [...(swmp.responsibilities ?? []), ...extra];
      }
    }
    // Overlay site controls so report reflects user-edited inputs (mock and real path)
    swmp.on_site_controls = buildOnSiteControlsFromInputs(normalizedInputs.site_controls);

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
