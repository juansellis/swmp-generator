import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CONVERSION_FACTORS_TABLE_MISSING =
  "Could not find the table 'public.conversion_factors' in the schema cache";

/**
 * GET /api/conversion-factors-status
 * Returns { configured: boolean }. Show warning only when configured === false.
 * configured = table exists, query succeeds, and (at least 1 active row OR no stream needs m/m3 conversions).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count: factorsCount, error: factorsError } = await supabase
    .from("conversion_factors")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (factorsError) {
    if (factorsError.message.includes(CONVERSION_FACTORS_TABLE_MISSING)) {
      return NextResponse.json({ configured: false });
    }
    return NextResponse.json({ configured: false });
  }

  const hasRows = (factorsCount ?? 0) >= 1;

  const { count: streamsNeedingCount, error: streamsError } = await supabase
    .from("waste_streams")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .or("default_density_kg_m3.not.is.null,default_kg_per_m.not.is.null");

  if (streamsError) {
    return NextResponse.json({ configured: hasRows });
  }

  const streamsNeedConversions = (streamsNeedingCount ?? 0) > 0;
  const configured = hasRows || !streamsNeedConversions;

  return NextResponse.json({ configured });
}
