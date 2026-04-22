"use client";

import { loadStripe } from "@stripe/stripe-js";

console.log(
  "Stripe key exists:",
  !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

// Required contract: publishable key read exactly like this.
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

