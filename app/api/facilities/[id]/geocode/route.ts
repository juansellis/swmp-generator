import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/maps/googleMaps";

type FacilityIdParams = { params: Promise<{ id: string }> };

async function requireSuperAdminAndFacility(facilityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return { error: response } as const;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_super_admin) {
    const response = NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
    return { error: response } as const;
  }
  const { data: facility, error: facilityErr } = await supabase
    .from("facilities")
    .select("id, address, lat, lng")
    .eq("id", facilityId)
    .single();
  if (facilityErr || !facility) {
    const response = NextResponse.json({ error: "Facility not found" }, { status: 404 });
    return { error: response } as const;
  }
  return { supabase, facilityId, facility } as const;
}

/**
 * POST /api/facilities/:id/geocode
 * Geocode facility address and save lat, lng. Admin only. Returns coords.
 */
export async function POST(_req: Request, { params }: FacilityIdParams) {
  const { id: facilityId } = await params;
  const access = await requireSuperAdminAndFacility(facilityId);
  if ("error" in access) return access.error;
  const { supabase, facilityId: id, facility } = access;

  const address = (facility.address ?? "").trim();
  if (!address) {
    return NextResponse.json(
      { error: "Facility has no address to geocode." },
      { status: 400 }
    );
  }

  const coords = await geocodeAddress(address);
  if (!coords) {
    return NextResponse.json(
      { error: "Geocoding failed or API key not configured." },
      { status: 502 }
    );
  }

  const { error: updateErr } = await supabase
    .from("facilities")
    .update({ lat: coords.lat, lng: coords.lng })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ lat: coords.lat, lng: coords.lng });
}
