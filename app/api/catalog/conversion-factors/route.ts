import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type ConversionFactorRow = {
  id: string;
  waste_stream_id: string;
  from_unit: string;
  to_unit: string;
  factor: number;
  is_active: boolean;
  notes: string | null;
  created_at: string | null;
};

/**
 * GET /api/catalog/conversion-factors
 * Returns conversion factors (waste_stream_id schema). Optional query: waste_stream_id to filter.
 * RLS: authenticated users can SELECT. Returns empty array if table is missing.
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
  const wasteStreamId = searchParams.get("waste_stream_id")?.trim() ?? null;

  let query = supabase
    .from("conversion_factors")
    .select("id, waste_stream_id, from_unit, to_unit, factor, is_active, notes, created_at")
    .eq("is_active", true)
    .order("waste_stream_id")
    .order("from_unit");

  if (wasteStreamId) {
    query = query.eq("waste_stream_id", wasteStreamId);
  }

  const { data: rows, error } = await query;

  if (error) {
    if (error.message.includes("Could not find the table 'public.conversion_factors' in the schema cache")) {
      return NextResponse.json({ conversion_factors: [] as ConversionFactorRow[] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    conversion_factors: (rows ?? []) as ConversionFactorRow[],
  });
}
