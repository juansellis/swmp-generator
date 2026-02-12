import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSuperAdminEmail } from "@/lib/auth/isSuperAdmin";

/**
 * GET /api/admin/users
 * Returns all profiles (id, email, full_name, is_super_admin, created_at) using
 * service role so RLS does not block. Gated: requester must be super admin
 * (same logic as /api/auth/check-admin: cookie session + profile or env).
 */
export async function GET() {
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
  const isSuperAdmin = fromProfile === true || fromEnv === true;

  if (!isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, is_super_admin, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: profiles ?? [] });
}
