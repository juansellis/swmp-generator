import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/isSuperAdmin";

/**
 * GET /api/auth/check-admin
 * Returns whether the current user (from cookies) is a super admin.
 * Uses profile.is_super_admin from profiles row keyed by auth.user.id (uuid).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ isSuperAdmin: false });
  }

  const authEmail = user.email ?? null;
  const authId = user.id;

  // Profile is queried by auth.user.id (uuid) against profiles.id only.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", authId)
    .single();

  const fromProfile = profile?.is_super_admin === true;
  const fromEnv = isSuperAdminEmail(authEmail);
  const canSeeAdminButton = fromProfile === true || fromEnv === true;

  // Temporary logs for diagnosis
  console.log("[check-admin] auth user email:", authEmail, "id:", authId);
  console.log("[check-admin] profile row fetched:", profile ?? "null", profileError ? `error: ${profileError.message}` : "");
  console.log("[check-admin] canSeeAdminButton:", canSeeAdminButton, "(fromProfile:", fromProfile, ", fromEnv:", fromEnv, ")");
  
  return NextResponse.json({ isSuperAdmin: canSeeAdminButton });
}

