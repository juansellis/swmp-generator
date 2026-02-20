import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/isSuperAdmin";

/**
 * GET /api/admin/stats
 * Returns counts for Admin Overview: partners, facilities, materials (active),
 * conversion_factors (active), users. Super-admin only.
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

  const [partnersRes, facilitiesRes, materialsRes, profilesRes, carbonVehicleRes, carbonResourceRes] = await Promise.all([
    supabase.from("partners").select("id", { count: "exact", head: true }),
    supabase.from("facilities").select("id", { count: "exact", head: true }),
    supabase.from("waste_streams").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("carbon_vehicle_factors").select("id", { count: "exact", head: true }),
    supabase.from("carbon_resource_factors").select("id", { count: "exact", head: true }),
  ]);

  const conversionsRes = await supabase
    .from("conversion_factors")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  const conversionsCount =
    conversionsRes.error &&
    conversionsRes.error.message.includes("Could not find the table 'public.conversion_factors' in the schema cache")
      ? 0
      : conversionsRes.count ?? 0;

  const carbonCount =
    (carbonVehicleRes.error && carbonVehicleRes.error.message.includes("Could not find the table") ? 0 : carbonVehicleRes.count ?? 0) +
    (carbonResourceRes.error && carbonResourceRes.error.message.includes("Could not find the table") ? 0 : carbonResourceRes.count ?? 0);

  return NextResponse.json({
    partners: partnersRes.count ?? 0,
    facilities: facilitiesRes.count ?? 0,
    materials: materialsRes.count ?? 0,
    conversions: conversionsCount,
    carbon: carbonCount,
    users: profilesRes.count ?? 0,
  });
}
