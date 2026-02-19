import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReportExportToken } from "@/lib/reportPdfToken";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/report/pdf?projectId=xxx
 * Generates a PDF of the report for the given project using Playwright.
 * Requires auth; user must own the project. Returns application/pdf.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId")?.trim();

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, user_id, name")
    .eq("id", projectId)
    .single();

  if (projectErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    new URL(req.url).origin;

  const token = createReportExportToken(projectId);
  const exportUrl = `${baseUrl}/projects/${projectId}/report/export?token=${encodeURIComponent(token)}`;

  try {
    const { chromium } = await import("playwright");

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--single-process"],
    });

    const context = await browser.newContext({
      viewport: { width: 1200, height: 1600 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    await page.goto(exportUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForSelector("[data-export-ready=\"true\"]", { timeout: 15000 }).catch(() => {});

    await new Promise((r) => setTimeout(r, 250));

    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 500));

    const projectName = (project as { name?: string | null }).name?.trim() || "Project";
    const headerHtml = `<div style="font-size:10px; color:#374151; width:100%; padding:0 16mm; box-sizing:border-box;"><span>${escapeHtml(projectName)}</span> <span>SWMP</span></div>`;
    const footerHtml = `<div style="font-size:9px; color:#6b7280; width:100%; padding:0 16mm; box-sizing:border-box; display:flex; justify-content:space-between; align-items:center;"><span>Prepared by WasteX</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "22mm", right: "16mm", bottom: "22mm", left: "16mm" },
      displayHeaderFooter: true,
      headerTemplate: headerHtml,
      footerTemplate: footerHtml,
    });

    await browser.close();

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="SWMP-${projectId.slice(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    const isPlaywrightMissing =
      typeof message === "string" &&
      (message.includes("Executable doesn't exist") ||
        message.includes("playwright install") ||
        message.includes("browserType.launch"));
    if (isPlaywrightMissing) {
      return NextResponse.json(
        {
          error:
            "PDF export is not configured on this environment. Run `npx playwright install`.",
          code: "PLAYWRIGHT_NOT_INSTALLED",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
