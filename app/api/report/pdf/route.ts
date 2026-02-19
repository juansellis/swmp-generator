import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReportExportToken } from "@/lib/reportPdfToken";
import type { Browser } from "playwright-core";

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
 * Generates a PDF of the report using serverless Chromium (@sparticuz/chromium + playwright-core).
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
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    new URL(req.url).origin;

  const token = createReportExportToken(projectId);
  const exportUrl = `${baseUrl}/projects/${projectId}/report/export?token=${encodeURIComponent(token)}`;

  let browser: Browser | null = null;

  try {
    const chromiumPkg = await import("@sparticuz/chromium");
    const chrom = (chromiumPkg as { default: { args: string[]; executablePath: () => Promise<string> } }).default;
    const { chromium: playwrightChromium } = await import("playwright-core");

    browser = await playwrightChromium.launch({
      args: chrom.args,
      executablePath: await chrom.executablePath(),
      headless: true,
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
    browser = null;

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
    console.error("[report/pdf] PDF generation failed:", message);
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    return NextResponse.json(
      { error: "PDF generation failed. Please try again or use Print → Save as PDF." },
      { status: 500 }
    );
  }
}
