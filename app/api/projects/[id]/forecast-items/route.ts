import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcWasteKg, calcWasteQty, getConversionOptions, syncForecastAllocationToInputs } from "@/lib/forecastApi";

type ProjectIdParams = { params: Promise<{ id: string }> };

/** Ensure the authenticated user owns the project. Returns [supabase, projectId] or error response. */
async function requireProjectAccess(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return { error: response } as const;
  }

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (projectErr || !project) {
    const response = NextResponse.json({ error: "Project not found" }, { status: 404 });
    return { error: response } as const;
  }
  if (project.user_id !== user.id) {
    const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return { error: response } as const;
  }
  return { supabase, projectId } as const;
}

/**
 * GET /api/projects/:id/forecast-items
 * List forecast items for the project. Auth: user must own the project.
 */
export async function GET(_req: Request, { params }: ProjectIdParams) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access.error;
  const { supabase } = access;

  const { data: items, error } = await supabase
    .from("project_forecast_items")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: items ?? [] });
}

/**
 * POST /api/projects/:id/forecast-items
 * Create a forecast item. Recomputes computed_waste_qty, syncs allocation to inputs, returns item + stream totals.
 * Body: { item_name, quantity, unit?, excess_percent?, kg_per_m?, density_kg_m3?, allocated_stream_id?, waste_stream_key? }
 */
export async function POST(req: Request, { params }: ProjectIdParams) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access.error;
  const { supabase } = access;

  let body: {
    item_name?: string;
    quantity?: number;
    unit?: string;
    excess_percent?: number;
    kg_per_m?: number | null;
    density_kg_m3?: number | null;
    allocated_stream_id?: string | null;
    waste_stream_key?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const item_name = typeof body?.item_name === "string" ? body.item_name.trim() : "";
  if (!item_name) {
    return NextResponse.json({ error: "item_name is required" }, { status: 400 });
  }

  const quantity = Number(body?.quantity);
  const excess_percent = Number(body?.excess_percent);
  if (Number.isNaN(quantity) || quantity < 0) {
    return NextResponse.json({ error: "quantity must be >= 0" }, { status: 400 });
  }
  if (Number.isNaN(excess_percent) || excess_percent < 0 || excess_percent > 100) {
    return NextResponse.json({ error: "excess_percent must be 0-100" }, { status: 400 });
  }

  const unit = typeof body?.unit === "string" && body.unit.trim() ? body.unit.trim() : "tonne";
  const kg_per_m = body?.kg_per_m != null && Number.isFinite(Number(body.kg_per_m)) ? Number(body.kg_per_m) : null;
  const density_kg_m3 = body?.density_kg_m3 != null && Number.isFinite(Number(body.density_kg_m3)) && Number(body.density_kg_m3) > 0 ? Number(body.density_kg_m3) : null;
  const allocated_stream_id = typeof body?.allocated_stream_id === "string" && body.allocated_stream_id.trim() ? body.allocated_stream_id.trim() : null;
  let waste_stream_key = body?.waste_stream_key != null ? (typeof body.waste_stream_key === "string" ? body.waste_stream_key.trim() || null : null) : null;

  if (allocated_stream_id && !waste_stream_key) {
    const { data: stream } = await supabase.from("waste_streams").select("name").eq("id", allocated_stream_id).single();
    if (stream?.name) waste_stream_key = String(stream.name).trim();
  }

  const conversionMap = await getConversionOptions(supabase);
  const streamOpts = waste_stream_key ? conversionMap.get(waste_stream_key) : undefined;
  const densityKgM3 = density_kg_m3 ?? (streamOpts?.densityKgM3 ?? null);
  const kgPerM = kg_per_m ?? (streamOpts?.kgPerM ?? null);
  const computed_waste_qty = calcWasteQty(quantity, excess_percent);
  const computed_waste_kg = calcWasteKg(quantity, excess_percent, unit, kgPerM ?? undefined, densityKgM3 ?? undefined);

  const insertPayload: Record<string, unknown> = {
    project_id: projectId,
    item_name,
    quantity,
    unit,
    excess_percent: Number.isNaN(excess_percent) ? 0 : excess_percent,
    kg_per_m: kg_per_m ?? null,
    density_kg_m3: density_kg_m3 ?? null,
    allocated_stream_id: allocated_stream_id ?? null,
    waste_stream_key: waste_stream_key ?? null,
    computed_waste_qty,
  };
  if (computed_waste_kg != null && Number.isFinite(computed_waste_kg)) {
    insertPayload.computed_waste_kg = computed_waste_kg;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("project_forecast_items")
    .insert(insertPayload)
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const sync = await syncForecastAllocationToInputs(supabase, projectId);

  return NextResponse.json({
    item: inserted,
    stream_totals: sync.streamTotals,
    unallocated_count: sync.unallocated_count,
    conversion_required_count: sync.conversion_required_count,
    included_count: sync.included_count,
  });
}
