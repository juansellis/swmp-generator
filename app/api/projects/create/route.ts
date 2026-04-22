import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validatePlaceId, MissingPlaceIdError, GooglePlacesError } from "@/lib/maps/validatePlaceId";

export type CreateProjectBody = {
  name: string;
  place_id: string;
  region: string;
  projectType: string;
  startDate: string;
  clientName: string;
  mainContractor: string;
  swmpOwner: string;
};

/**
 * POST /api/projects/create
 * Server-side project creation with credit gate:
 * - First site: free (free_site_used -> true, transaction type 'site_created' with note 'Free site').
 * - Else: consume 1 site credit if balance > 0.
 * - If no entitlement: 402 with { code: 'no_credits' }.
 * All credit changes are done server-side; client cannot grant itself credits.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateProjectBody & { projectTypeOther?: string };
  try {
    const raw = await req.json();
    body = raw as CreateProjectBody & { projectTypeOther?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2) {
    return NextResponse.json(
      { error: "Project name must be at least 2 characters" },
      { status: 400 }
    );
  }

  const placeId = typeof body?.place_id === "string" ? body.place_id.trim() : "";
  if (!placeId) {
    return NextResponse.json(
      { error: "Site address (place_id) is required" },
      { status: 400 }
    );
  }

  let serverAddress: { formatted_address: string; place_id: string; lat: number; lng: number };
  try {
    serverAddress = await validatePlaceId(placeId);
  } catch (err) {
    if (err instanceof MissingPlaceIdError) {
      return NextResponse.json(
        { error: "Please select an address from the suggestions." },
        { status: 400 }
      );
    }
    if (err instanceof GooglePlacesError) {
      return NextResponse.json(
        { error: "Address validation failed." },
        { status: 502 }
      );
    }
    throw err;
  }

  const region = (body?.region ?? "").trim();
  const projectType =
    body?.projectType === "Other"
      ? (body?.projectTypeOther ?? "Other").trim() || "Other"
      : (body?.projectType ?? "").trim();
  const startDate = (body?.startDate ?? "").trim();
  const clientName = (body?.clientName ?? "").trim();
  const mainContractor = (body?.mainContractor ?? "").trim();
  const swmpOwner = (body?.swmpOwner ?? "").trim();

  if (!region || !projectType || !startDate || !clientName || !mainContractor || !swmpOwner) {
    return NextResponse.json(
      { error: "Region, project type, start date, client name, main contractor, and SWMP owner are required." },
      { status: 400 }
    );
  }

  const accountId = user.id;

  // Get or create account_credits (service role)
  const { data: creditsRow } = await supabaseAdmin
    .from("account_credits")
    .select("id, free_site_used, site_credits_balance")
    .eq("account_id", accountId)
    .single();

  let freeSiteUsed = creditsRow?.free_site_used ?? false;
  let siteCreditsBalance = creditsRow?.site_credits_balance ?? 0;

  if (!creditsRow) {
    const { error: insertCreditsErr } = await supabaseAdmin.from("account_credits").insert({
      account_id: accountId,
      site_credits_balance: 0,
      free_site_used: false,
    });
    if (insertCreditsErr) {
      return NextResponse.json(
        { error: "Failed to initialize billing state", details: insertCreditsErr.message },
        { status: 500 }
      );
    }
    freeSiteUsed = false;
    siteCreditsBalance = 0;
  }

  const canUseFreeSite = !freeSiteUsed;
  const canUseCredit = siteCreditsBalance > 0;

  if (!canUseFreeSite && !canUseCredit) {
    return NextResponse.json(
      { error: "No site credits remaining. Purchase credits to create more projects.", code: "no_credits" },
      { status: 402 }
    );
  }

  const useFreeSite = canUseFreeSite;

  // Insert project (service role so we can write on behalf of user)
  const { data: project, error: projectErr } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: accountId,
      name,
      address: serverAddress.formatted_address,
      site_address: serverAddress.formatted_address,
      site_place_id: serverAddress.place_id,
      site_lat: serverAddress.lat,
      site_lng: serverAddress.lng,
      region,
      project_type: projectType,
      start_date: startDate,
      end_date: null,
      client_name: clientName,
      main_contractor: mainContractor,
      swmp_owner: swmpOwner,
    })
    .select("id")
    .single();

  if (projectErr) {
    return NextResponse.json(
      { error: projectErr.message },
      { status: 500 }
    );
  }

  if (useFreeSite) {
    await supabaseAdmin
      .from("account_credits")
      .update({
        free_site_used: true,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);
    await supabaseAdmin.from("credit_transactions").insert({
      account_id: accountId,
      type: "site_created",
      quantity: 1,
      source: "free_site",
      notes: "Free site",
    });
  } else {
    await supabaseAdmin
      .from("account_credits")
      .update({
        site_credits_balance: siteCreditsBalance - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);
    await supabaseAdmin.from("credit_transactions").insert({
      account_id: accountId,
      type: "site_created",
      quantity: 1,
      source: "credit",
      notes: "Site credit consumed",
    });
  }

  return NextResponse.json({ id: project.id });
}
