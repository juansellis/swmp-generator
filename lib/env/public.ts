type NonEmptyString = string & { __brand: "non-empty" };

function requirePublicEnv(name: string): NonEmptyString {
  const v = process.env[name];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`Missing ${name}`);
  }
  return v as NonEmptyString;
}

/**
 * Public env accessor (client-safe).
 *
 * IMPORTANT: lazily read so importing this module never throws during build.
 */
export const envPublic = {
  stripe: {
    publishableKey: () => requirePublicEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  },
  app: {
    publicUrl: () => requirePublicEnv("NEXT_PUBLIC_APP_URL"),
  },
  supabase: {
    url: () => requirePublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: () => requirePublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  },
} as const;

