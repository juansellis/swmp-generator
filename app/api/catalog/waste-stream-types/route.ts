import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/isSuperAdmin";

export type WasteStreamTypeRow = {
  id: string;
  name: string;
  category: string | null;
  sort_order: number;
};

/**
 * GET /api/catalog/waste-stream-types
 * Returns active waste stream types for Forecast Material Type dropdown.
 * RLS: authenticated users can SELECT where is_active = true.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("waste_stream_types")
    .select("id, name, category, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    waste_stream_types: (rows ?? []) as WasteStreamTypeRow[],
  });
}

/**
 * POST /api/catalog/waste-stream-types
 * Create a new waste stream type. Super admin only.
 * Body: { name: string, category?: string | null }
 */
export async function POST(req: Request) {
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
  const fromProfile = profile?.is_super_admin === true;
  const fromEnv = isSuperAdminEmail(user.email ?? null);
  if (!fromProfile && !fromEnv) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string; category?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const category = body?.category != null ? (typeof body.category === "string" ? body.category.trim() : null) : null;
  const maxOrder = await supabase
    .from("waste_stream_types")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxOrder.data?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("waste_stream_types")
    .insert({ name, category, sort_order })
    .select("id, name, category, sort_order")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Name already exists" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ waste_stream_type: inserted as WasteStreamTypeRow });
}
