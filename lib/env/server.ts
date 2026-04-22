type NonEmptyString = string & { __brand: "non-empty" };

function requireEnv(name: string): NonEmptyString {
  const v = process.env[name];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`Missing ${name}`);
  }
  return v as NonEmptyString;
}

function optionalEnv(name: string): string | null {
  const v = process.env[name];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/**
 * Server env accessor.
 *
 * IMPORTANT: all values are lazily read so importing this module never throws during build.
 * Call the functions at runtime inside request handlers / server-only code paths.
 */
export const envServer = {
  stripe: {
    secretKey: () => requireEnv("STRIPE_SECRET_KEY"),
    webhookSecret: () => requireEnv("STRIPE_WEBHOOK_SECRET"),
    priceSingleSite: () => requireEnv("STRIPE_PRICE_SINGLE_SITE"),
    priceSiteBundle: () => requireEnv("STRIPE_PRICE_SITE_BUNDLE"),
  },
  supabase: {
    url: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: () => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
  app: {
    publicUrl: () => requireEnv("NEXT_PUBLIC_APP_URL"),
  },
  nodeEnv: () => optionalEnv("NODE_ENV") ?? "development",
} as const;

