import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWasteStrategy } from "@/lib/planning/wasteStrategyBuilder";

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
 * GET /api/projects/:id/waste-strategy
 * Returns WasteStrategyResult for the project. Auth: user must own the project.
 */
export async function GET(_req: Request, { params }: ProjectIdParams) {
  const { id: projectId } = await params;
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access.error;
  const { supabase } = access;

  try {
    const result = await buildWasteStrategy(projectId, supabase);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build waste strategy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
