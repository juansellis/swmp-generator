import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validatePlaceId,
  MissingPlaceIdError,
  GooglePlacesError,
} from "@/lib/maps/validatePlaceId";

const isDev = process.env.NODE_ENV === "development";

/**
 * POST /api/validate-address
 * Body: { place_id: string }
 * Server re-validates via Google Places API (v1) and returns formatted_address, place_id, lat, lng.
 * Never trust client-sent coords; always use this before saving project/facility address.
 * Server must use GOOGLE_MAPS_API_KEY (not NEXT_PUBLIC_*).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { place_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON", message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const placeId = typeof body.place_id === "string" ? body.place_id.trim() : "";

  if (isDev) {
    // eslint-disable-next-line no-console
    console.log("[validate-address] place_id received:", placeId ? "yes" : "no");
  }

  try {
    const result = await validatePlaceId(placeId);
    return NextResponse.json({
      formatted_address: result.formatted_address,
      place_id: result.place_id,
      lat: result.lat,
      lng: result.lng,
    });
  } catch (err) {
    if (err instanceof MissingPlaceIdError) {
      return NextResponse.json(
        { error: "Please select an address from the suggestions.", message: "Please select an address from the suggestions." },
        { status: 400 }
      );
    }
    if (err instanceof GooglePlacesError) {
      const isServerConfig = err.message.includes("GOOGLE_MAPS_API_KEY");
      if (isServerConfig) {
        return NextResponse.json(
          {
            error: "Server missing GOOGLE_MAPS_API_KEY.",
            message: "Server missing GOOGLE_MAPS_API_KEY.",
          },
          { status: 500 }
        );
      }
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error("Places validation failed", {
          status: err.status,
          google_error: err.google_error,
        });
      }
      return NextResponse.json(
        {
          message: "Google address validation failed",
          error: "Google address validation failed",
          status: err.status,
          google_error: err.google_error,
        },
        { status: 502 }
      );
    }
    throw err;
  }
}
