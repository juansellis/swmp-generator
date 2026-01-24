// app/api/generate-swmp/route.ts

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { openai } from "@/lib/openai";
import { SwmpSchema } from "@/lib/swmpSchema";
import { renderSwmpHtml } from "@/lib/renderSwmp";
import { zodTextFormat } from "openai/helpers/zod";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const project_id = String(body?.project_id ?? "").trim();

    if (!project_id) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }

    // 1) Fetch project (server/admin client)
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

    // 4) Build NZ-first instructions + input
    const instructions =
      "You are a New Zealand construction waste specialist. Produce a practical, NZ-first Site Waste Management Plan (SWMP) that is site-usable. Use NZ terminology (skip, transfer station, cleanfill, weighbridge dockets, toolbox talks). Avoid generic fluff. If details are missing, make reasonable assumptions and list them in assumptions. Output must follow the provided schema exactly.";

    const inputPayload = {
      project: {
        id: project.id,
        name: project.name,
        address: project.address ?? "",
        region: project.region ?? "Other (NZ)",
        project_type: project.project_type ?? "Construction project",
        start_date: project.start_date,
        end_date: project.end_date,
        main_contractor: project.main_contractor,
        swmp_owner: project.swmp_owner,
      },
      inputs: {
        sorting_level: inputs.sorting_level,
        target_diversion: inputs.target_diversion,
        constraints: inputs.constraints,
        waste_streams: inputs.waste_streams,
        hazards: inputs.hazards,
        logistics: inputs.logistics,
        notes: inputs.notes,
      },
      required: {
        include_bin_recommendation: true,
        include_monitoring_checklist: true,
        include_corrective_actions: true,
      },
    };

    if (process.env.MOCK_SWMP === "1") {
      const today = new Date().toISOString().slice(0, 10);
    
      const swmp = SwmpSchema.parse({
        title: "Site Waste Management Plan (SWMP)",
        prepared_for: project.main_contractor ?? "Main Contractor",
        prepared_by: project.swmp_owner ?? "SWMP Owner",
        date_prepared: today,
        project_overview: {
          project_name: project.name,
          address: project.address ?? "",
          region: project.region ?? "Other (NZ)",
          project_type: project.project_type ?? "Construction project",
          programme: `Start: ${project.start_date ?? "TBC"} | End: ${project.end_date ?? "TBC"}`,
          site_constraints: inputs.constraints ?? [],
        },
        objectives: {
          diversion_target_percent: inputs.target_diversion ?? 70,
          primary_objectives: [
            "Maximise diversion of recoverable materials via on-site separation where practical.",
            "Minimise contamination through clear signage, storage controls, and trade engagement.",
            "Maintain auditable records (dockets/weights) and report performance regularly.",
          ],
        },
        roles_and_responsibilities: [
          {
            role: "SWMP Owner",
            name_or_party: project.swmp_owner ?? "SWMP Owner",
            responsibilities: ["Maintain SWMP", "Coordinate waste streams and reporting", "Drive continuous improvement"],
          },
          {
            role: "Site Manager",
            name_or_party: "Main Contractor",
            responsibilities: ["Ensure bins are used correctly", "Run inductions/toolbox talks", "Manage contamination issues"],
          },
          {
            role: "All trades",
            name_or_party: "Subcontractors",
            responsibilities: ["Follow segregation rules", "Keep areas tidy", "Report issues to Site Manager"],
          },
        ],
        waste_streams: (inputs.waste_streams ?? []).slice(0, 6).map((s: string) => ({
          stream: s,
          segregation_method: "Separate where practical",
          container: "Skip / cage as allocated",
          handling_notes: "Keep dry/clean, avoid contamination, flatten where possible.",
          destination: "Approved recycler / transfer station",
        })),
        onsite_separation_plan: {
          bin_setup_recommendation: ["Provide dedicated skips/cages for key streams.", "Locate bins close to workfaces where safe."],
          signage_and_storage: ["Simple signage with examples.", "Covered storage for cardboard/plasterboard.", "Keep separation zones clear."],
          contamination_controls: [
            "Daily spot checks by Site Manager.",
            "Remove contaminants immediately and brief responsible trade.",
            "Keep lids/covering to prevent weather damage.",
            "No mixed hazardous materials into general skips.",
          ],
        },
        regulated_and_hazardous: {
          flags: inputs.hazards ?? { asbestos: false, lead_paint: false, contaminated_soil: false },
          controls: ["Segregate regulated materials and use licensed contractors where required.", "Keep records and disposal documentation."],
        },
        training_and_comms: {
          induction_points: ["Explain bin streams and contamination rules.", "Show bin locations and signage.", "Explain reporting expectations."],
          toolbox_talk_topics: ["Contamination examples", "Keeping materials dry", "Recording dockets/weights"],
        },
        monitoring_and_reporting: {
          reporting_cadence: inputs.logistics?.reporting_cadence ?? "Weekly",
          checklists: [
            { item: "Bins labelled and correctly located", frequency: "Weekly", owner: "Site Manager" },
            { item: "Contamination checks completed", frequency: "Weekly", owner: "Site Manager" },
            { item: "Dockets/weights filed", frequency: "Weekly", owner: "SWMP Owner" },
          ],
          corrective_actions: ["Brief trade responsible for contamination", "Adjust bin locations/signage", "Escalate repeat issues to PM"],
          evidence_to_keep: ["Weighbridge dockets", "Photos of bins/signage", "Weekly summary reports"],
        },
        assumptions: ["Final bin configuration to be confirmed at site establishment."],
      });
    
      const html = renderSwmpHtml(swmp);
    
      const { data: saved, error: saveErr } = await supabaseAdmin
        .from("swmps")
        .insert({ project_id, version: nextVersion, content_json: swmp, content_html: html })
        .select("id, version")
        .single();
    
      if (saveErr || !saved) {
        return NextResponse.json({ error: saveErr?.message ?? "Failed to save SWMP" }, { status: 500 });
      }
    
      return NextResponse.json({ swmp_id: saved.id, version: saved.version });
    }
    

    // 5) Call OpenAI Responses API with Structured Outputs (text.format)
    const response = await openai.responses.parse({
      // Use a model that supports Structured Outputs well
      model: "gpt-4o-mini",
      instructions,
      input: JSON.stringify(inputPayload),
      text: {
        format: zodTextFormat(SwmpSchema, "swmp"),
      },
    });

    const swmp = response.output_parsed;
    if (!swmp) {
      return NextResponse.json({ error: "No parsed SWMP returned by model." }, { status: 500 });
    }

    // 6) Render HTML for viewing/export
    const html = renderSwmpHtml(swmp);

    // 7) Save SWMP record
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
      return NextResponse.json(
        { error: saveErr?.message ?? "Failed to save SWMP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ swmp_id: saved.id, version: saved.version });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
