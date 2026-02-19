import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getSecret(): string {
  const s = process.env.REPORT_PDF_SECRET ?? process.env.CRON_SECRET ?? "report-pdf-dev-secret";
  return String(s);
}

/**
 * Create a signed token for one-time access to report export (no auth required when token present).
 * Payload: projectId + expiry timestamp.
 */
export function createReportExportToken(projectId: string): string {
  const expiry = String(Date.now() + TOKEN_TTL_MS);
  const payload = `${expiry}.${projectId}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Verify token and return projectId if valid. Returns null if invalid or expired.
 */
export function verifyReportExportToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [expiryStr, projectId, sig] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;
  const payload = `${expiryStr}.${projectId}`;
  const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig)))
    return null;
  return projectId;
}
