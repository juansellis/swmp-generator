import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

const REPORT_STATUS_VALUES = ["in_progress", "sent_for_review", "declined", "approved"] as const;
type ReportStatusValue = (typeof REPORT_STATUS_VALUES)[number];

function isReportStatus(value: unknown): value is ReportStatusValue {
  return typeof value === "string" && REPORT_STATUS_VALUES.includes(value as ReportStatusValue);
}

/**
 * PATCH /api/projects/:id
 * Body: { report_status?: "in_progress" | "sent_for_review" | "declined" | "approved" }
 * Updates project.report_status. Respects auth/RLS; only owner can update.
 */
export async function PATCH(req: Request, { params }: Params) {
  const { id: projectId } = await params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { report_status?: unknown } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // empty body
  }

  if (!isReportStatus(body.report_status)) {
    return NextResponse.json(
      { error: "report_status must be one of: in_progress, sent_for_review, declined, approved" },
      { status: 400 }
    );
  }

  const { data: project, error: fetchErr } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (fetchErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateErr } = await supabase
    .from("projects")
    .update({ report_status: body.report_status })
    .eq("id", projectId);

  if (updateErr) {
    return NextResponse.json(
      { error: updateErr.message ?? "Failed to update report status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ report_status: body.report_status });
}
