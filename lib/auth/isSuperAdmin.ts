/**
 * Super-admin gating: only if email is in SUPER_ADMIN_EMAILS (comma-separated).
 * Server: use SUPER_ADMIN_EMAILS in .env.local.
 * Client: use NEXT_PUBLIC_SUPER_ADMIN_EMAILS (SUPER_ADMIN_EMAILS is not exposed to the browser).
 */

function getAllowedEmails(): string[] {
  const list =
    process.env.SUPER_ADMIN_EMAILS ??
    process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS ??
    "";
  return list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true only when email is in the allowed list (normalised: lowercase, trimmed).
 */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (email == null || typeof email !== "string") return false;
  const allowed = getAllowedEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}
