/**
 * Distance API: returns driving distance (km) between origin and destination addresses.
 * Call only when destination is non-blank (client enforces).
 * Stub implementation; replace with Google Distance Matrix or similar when ready.
 */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const origin = typeof body?.origin === "string" ? body.origin.trim() : "";
    const destination = typeof body?.destination === "string" ? body.destination.trim() : "";

    if (!destination) {
      return NextResponse.json(
        { error: "Destination is required." },
        { status: 400 }
      );
    }

    // Stub: no external API key. Replace with e.g. Google Distance Matrix when ready.
    const distance_km = 0;

    return NextResponse.json({ distance_km });
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
