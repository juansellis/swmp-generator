import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanningChecklist } from "@/lib/planning/planningChecklist";

type ProjectIdParams = { params: Promise<{ id: string }> };

async function requireProjectAccess(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return { error: response } as const;
  }
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();
  if (projectErr || !project) {
    const response = NextResponse.json({ error: "Project not found" }, { status: 404 });
    return { error: response } as const;
  }
  if (project.user_id !== user.id) {
    const response = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return { error: response } as const;
  }
  return { supabase, projectId } as const;
}

/**
 * GET /api/projects/:id/planning-checklist
 * Returns PlanningChecklist (readiness_score, items, next_best_action). Auth-protected.
 */
export async function GET(_req: Request, { params }: ProjectIdParams) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access.error;
  const { supabase } = access;

  try {
    const checklist = await getPlanningChecklist(projectId, supabase);
    return NextResponse.json(checklist);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load planning checklist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
