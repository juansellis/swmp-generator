import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcWasteKg, calcWasteQty, syncForecastAllocationToInputs } from "@/lib/forecastApi";

type ItemIdParams = { params: Promise<{ itemId: string }> };

/** Resolve item, ensure user owns the project. Returns [supabase, projectId, item] or error response. */
async function requireForecastItemAccess(itemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return { error: res };
  }

  const { data: item, error: itemErr } = await supabase
    .from("project_forecast_items")
    .select("id, project_id")
    .eq("id", itemId)
    .single();

  if (itemErr || !item) {
    const res = NextResponse.json({ error: "Forecast item not found" }, { status: 404 });
    return { error: res };
  }

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", item.project_id)
    .single();

  if (projectErr || !project || project.user_id !== user.id) {
    const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return { error: res };
  }

  return { supabase, projectId: item.project_id } as const;
}

/**
 * PATCH /api/forecast-items/:itemId
 * Update a forecast item. Recomputes computed_waste_qty, syncs allocation, returns item + stream totals.
 * Body: partial { item_name, quantity, unit, excess_percent, material_type, material_type_id, waste_stream_key }
 */
export async function PATCH(req: Request, { params }: ItemIdParams) {
  const { itemId } = await params;
  const access = await requireForecastItemAccess(itemId);
  if ("error" in access) return access.error;
  const { supabase, projectId } = access;

  let body: {
    item_name?: string;
    quantity?: number;
    unit?: string;
    excess_percent?: number;
    kg_per_m?: number | null;
    material_type?: string | null;
    material_type_id?: string | null;
    waste_stream_key?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("project_forecast_items")
    .select("quantity, excess_percent, unit, kg_per_m, item_name, material_type, material_type_id, waste_stream_key")
    .eq("id", itemId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Forecast item not found" }, { status: 404 });
  }

  const quantity = body.quantity !== undefined ? Number(body.quantity) : Number(existing.quantity);
  const excess_percent = body.excess_percent !== undefined ? Number(body.excess_percent) : Number(existing.excess_percent);
  if (!Number.isNaN(quantity) && quantity < 0) {
    return NextResponse.json({ error: "quantity must be >= 0" }, { status: 400 });
  }
  if (!Number.isNaN(excess_percent) && (excess_percent < 0 || excess_percent > 100)) {
    return NextResponse.json({ error: "excess_percent must be 0-100" }, { status: 400 });
  }

  const unit = body.unit !== undefined ? (typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : body.unit) : existing.unit;
  const kg_per_m = body.kg_per_m !== undefined
    ? (body.kg_per_m != null && Number.isFinite(Number(body.kg_per_m)) ? Number(body.kg_per_m) : null)
    : (existing.kg_per_m != null ? Number(existing.kg_per_m) : null);
  const computed_waste_qty = calcWasteQty(quantity, excess_percent);
  const computed_waste_kg = calcWasteKg(quantity, excess_percent, unit, kg_per_m ?? undefined);

  const payload: Record<string, unknown> = {
    computed_waste_qty,
    computed_waste_kg: computed_waste_kg != null && Number.isFinite(computed_waste_kg) ? computed_waste_kg : null,
    kg_per_m: kg_per_m ?? null,
    item_name: body.item_name !== undefined ? (typeof body.item_name === "string" ? body.item_name.trim() : body.item_name) : existing.item_name,
    quantity: body.quantity !== undefined ? body.quantity : existing.quantity,
    unit,
    excess_percent: body.excess_percent !== undefined ? body.excess_percent : existing.excess_percent,
    material_type: body.material_type !== undefined ? (body.material_type === null || (typeof body.material_type === "string" && !body.material_type.trim()) ? null : (typeof body.material_type === "string" ? body.material_type.trim() : body.material_type)) : existing.material_type,
    material_type_id: body.material_type_id !== undefined ? (body.material_type_id === null || body.material_type_id === "" ? null : body.material_type_id) : existing.material_type_id,
    waste_stream_key: body.waste_stream_key !== undefined ? (body.waste_stream_key === null || (typeof body.waste_stream_key === "string" && !body.waste_stream_key.trim()) ? null : (typeof body.waste_stream_key === "string" ? body.waste_stream_key.trim() : body.waste_stream_key)) : existing.waste_stream_key,
  };

  const { data: updated, error: updateErr } = await supabase
    .from("project_forecast_items")
    .update(payload)
    .eq("id", itemId)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const sync = await syncForecastAllocationToInputs(supabase, projectId);

  return NextResponse.json({
    item: updated,
    stream_totals: sync.streamTotals,
    unallocated_count: sync.unallocated_count,
    conversion_required_count: sync.conversion_required_count,
    included_count: sync.included_count,
  });
}

/**
 * DELETE /api/forecast-items/:itemId
 * Delete a forecast item. Syncs allocation (removes item from totals), returns stream totals.
 */
export async function DELETE(_req: Request, { params }: ItemIdParams) {
  const { itemId } = await params;
  const access = await requireForecastItemAccess(itemId);
  if ("error" in access) return access.error;
  const { supabase, projectId } = access;

  const { error: deleteErr } = await supabase
    .from("project_forecast_items")
    .delete()
    .eq("id", itemId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  const sync = await syncForecastAllocationToInputs(supabase, projectId);

  return NextResponse.json({
    stream_totals: sync.streamTotals,
    unallocated_count: sync.unallocated_count,
    conversion_required_count: sync.conversion_required_count,
    included_count: sync.included_count,
  });
}
