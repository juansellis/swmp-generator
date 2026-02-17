import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/isSuperAdmin";

export type WasteStreamRow = {
  id: string;
  key: string;
  name: string;
  category: string | null;
  default_unit: string;
  default_density_kg_m3: number | null;
  default_kg_per_m: number | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
};

/**
 * GET /api/catalog/waste-streams
 * Returns waste streams for Facilities accepted streams, Inputs, Forecast allocation.
 * Query ?all=1 (super-admin only) returns inactive too; otherwise active only.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";
  let isSuperAdmin = false;
  if (all) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();
    isSuperAdmin =
      profile?.is_super_admin === true || isSuperAdminEmail(user.email ?? null);
  }

  let query = supabase
    .from("waste_streams")
    .select("id, key, name, category, default_unit, default_density_kg_m3, default_kg_per_m, is_active, sort_order, notes")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!all || !isSuperAdmin) {
    query = query.eq("is_active", true);
  }
  // RLS: authenticated sees only active; super_admin sees all when ?all=1 (policy allows all)

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    waste_streams: (rows ?? []) as WasteStreamRow[],
  });
}
