import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * POST /api/stripe/webhook
 * Verifies Stripe signature and handles checkout.session.completed:
 * - Increment account_credits.site_credits_balance
 * - Insert credit_transactions (type 'purchase')
 * - Persist stripe_customer_id on profiles if missing
 * Credits are NEVER granted from the frontend redirect; only here.
 */
export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const headerList = await headers();
  const signature = headerList.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeSecretKey);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const accountId = session.metadata?.account_id;
  const creditsToAdd = parseInt(session.metadata?.credits_to_add ?? "0", 10);

  if (!accountId || creditsToAdd <= 0) {
    return NextResponse.json(
      { error: "Missing account_id or credits_to_add in session metadata" },
      { status: 400 }
    );
  }

  // Idempotency: if we've already recorded this session, do nothing
  const { data: existingTx } = await supabaseAdmin
    .from("credit_transactions")
    .select("id")
    .eq("account_id", accountId)
    .eq("stripe_session_id", session.id)
    .limit(1);
  if (existingTx && existingTx.length > 0) {
    return NextResponse.json({ received: true });
  }

  // Upsert account_credits and add balance
  const { data: existing } = await supabaseAdmin
    .from("account_credits")
    .select("id, site_credits_balance")
    .eq("account_id", accountId)
    .single();

  if (existing) {
    const { error: updateErr } = await supabaseAdmin
      .from("account_credits")
      .update({
        site_credits_balance: existing.site_credits_balance + creditsToAdd,
        updated_at: new Date().toISOString(),
      })
      .eq("account_id", accountId);
    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to update credits", details: updateErr.message },
        { status: 500 }
      );
    }
  } else {
    const { error: insertErr } = await supabaseAdmin.from("account_credits").insert({
      account_id: accountId,
      site_credits_balance: creditsToAdd,
      free_site_used: false,
    });
    if (insertErr) {
      return NextResponse.json(
        { error: "Failed to create account_credits", details: insertErr.message },
        { status: 500 }
      );
    }
  }

  const { error: txErr } = await supabaseAdmin.from("credit_transactions").insert({
    account_id: accountId,
    type: "purchase",
    quantity: creditsToAdd,
    source: "stripe",
    stripe_session_id: session.id,
    notes: session.metadata?.package_type ?? "checkout",
  });
  if (txErr) {
    return NextResponse.json(
      { error: "Failed to record transaction", details: txErr.message },
      { status: 500 }
    );
  }

  // Persist Stripe customer ID if present and profile doesn't have it
  const customerId: string | null =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as { id?: string } | null)?.id ?? null;
  if (customerId) {
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .is("stripe_customer_id", null);
  }

  return NextResponse.json({ received: true });
}
