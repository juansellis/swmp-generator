import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { envServer } from "@/lib/env/server";

/**
 * POST /api/billing/create-checkout-session
 * Body: { package: 'single' | 'bundle', accountId: string }
 * Creates Stripe Checkout Session (mode=payment). Credits are granted only via webhook.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate required server env (throws with clear message if missing)
  let stripeSecretKey: string;
  let priceSingleSite: string;
  let priceSiteBundle: string;
  let publicUrl: string;
  try {
    stripeSecretKey = envServer.stripe.secretKey();
    priceSingleSite = envServer.stripe.priceSingleSite();
    priceSiteBundle = envServer.stripe.priceSiteBundle();
    publicUrl = envServer.app.publicUrl();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Billing is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  let body: { package?: string; accountId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Production-safe: do not allow spoofing account_id from the client
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  if (!accountId || accountId !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pkg = body.package === "bundle" ? "bundle" : "single";
  const priceId =
    pkg === "bundle"
      ? priceSiteBundle
      : priceSingleSite;
  const creditsToAdd = pkg === "bundle" ? 5 : 1;

  const stripe = new Stripe(stripeSecretKey);

  // Optional: use existing Stripe customer if we have one (from profiles)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const customerId = profile?.stripe_customer_id ?? undefined;
  const customerEmail = user.email ?? undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: customerId ?? undefined,
      customer_email: !customerId ? customerEmail : undefined,
      metadata: {
        account_id: accountId,
        package_type: pkg,
        credits_to_add: String(creditsToAdd),
      },
      success_url: `${publicUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicUrl}/billing`,
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
