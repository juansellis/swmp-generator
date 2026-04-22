import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/billing/credits
 * Returns current user's account_credits (site_credits_balance, free_site_used).
 * RLS allows users to SELECT own account_credits.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("account_credits")
    .select("site_credits_balance, free_site_used")
    .eq("account_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({
        site_credits_balance: 0,
        free_site_used: false,
      });
    }
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    site_credits_balance: data?.site_credits_balance ?? 0,
    free_site_used: data?.free_site_used ?? false,
  });
}
