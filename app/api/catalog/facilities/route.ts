import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/catalog/facilities?partner_id=uuid&region=...&stream=...
 * Returns facilities filtered by partner_id (required). Optionally filter by region and/or stream (accepted_streams contains stream).
 * Requires authenticated user; RLS allows read for authenticated.
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
  const selectedPartnerId = searchParams.get("partner_id")?.trim() || null;
  const region = searchParams.get("region")?.trim() || null;
  const stream = searchParams.get("stream")?.trim() || null;

  console.log("fetching facilities for", selectedPartnerId);

  if (!selectedPartnerId) {
    return NextResponse.json(
      { error: "partner_id is required", facilities: [] },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("facilities")
    .select("id, name, facility_type, region, accepted_streams, address, partner_id")
    .eq("partner_id", selectedPartnerId)
    .order("name", { ascending: true });

  console.log("facilities error", error?.message ?? null);
  console.log("facilities count", data?.length ?? 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let facilities = data ?? [];

  if (region) {
    facilities = facilities.filter(
      (f) => (f.region ?? "").toLowerCase() === region.toLowerCase()
    );
  }
  if (stream) {
    const streamLower = stream.toLowerCase();
    facilities = facilities.filter((f) => {
      const streams = (f.accepted_streams ?? []) as string[];
      return streams.some((s) => String(s).toLowerCase().includes(streamLower) || streamLower.includes(String(s).toLowerCase()));
    });
  }

  return NextResponse.json({ facilities });
}
