import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/catalog/partners
 * Returns partners for dropdown (id, name, regions, partner_type).
 * Requires authenticated user; RLS allows read for authenticated.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: partners, error } = await supabase
    .from("partners")
    .select("id, name, regions, partner_type")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ partners: partners ?? [] });
}
