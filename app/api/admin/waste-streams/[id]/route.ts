import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSuperAdminEmail } from "@/lib/auth/isSuperAdmin";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNumOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function toSortOrder(value: unknown, fallback: number): number {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return n;
}

type PatchBody = {
  name?: string;
  category?: string | null;
  default_unit?: string;
  default_density_kg_m3?: number | null;
  default_kg_per_m?: number | null;
  is_active?: boolean;
  sort_order?: number;
  notes?: string | null;
};

/**
 * PATCH /api/admin/waste-streams/[id]
 * Update a waste stream by id. Super-admin only. Uses service role so RLS does not block.
 * Body: { name?, category?, default_unit?, default_density_kg_m3?, default_kg_per_m?, is_active?, sort_order?, notes? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid waste stream id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  const isSuperAdmin =
    profile?.is_super_admin === true || isSuperAdminEmail(user.email ?? null);

  if (!isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (body.name !== undefined) payload.name = typeof body.name === "string" ? body.name.trim() : "";
  if (body.category !== undefined) payload.category = body.category === null || body.category === "" ? null : String(body.category).trim();
  if (body.default_unit !== undefined) payload.default_unit = typeof body.default_unit === "string" && body.default_unit.trim() ? body.default_unit.trim() : "tonne";
  if (body.default_density_kg_m3 !== undefined) payload.default_density_kg_m3 = toNumOrNull(body.default_density_kg_m3);
  if (body.default_kg_per_m !== undefined) payload.default_kg_per_m = toNumOrNull(body.default_kg_per_m);
  if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);
  if (body.sort_order !== undefined) payload.sort_order = toSortOrder(body.sort_order, 0);
  if (body.notes !== undefined) payload.notes = body.notes === null || body.notes === "" ? null : String(body.notes).trim();

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("waste_streams")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
