import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type MaterialTypeRow = {
  id: string;
  key: string;
  name: string;
  category: string | null;
  default_density_kg_m3: number | null;
  default_kg_per_m: number | null;
  default_unit: string | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string | null;
};

/**
 * GET /api/catalog/materials
 * Returns active material types for Forecast material dropdown and conversion defaults.
 * RLS: authenticated users can SELECT.
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
    .from("material_types")
    .select("id, key, name, category, default_density_kg_m3, default_kg_per_m, default_unit, is_active, sort_order, notes, created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    materials: (rows ?? []) as MaterialTypeRow[],
  });
}
