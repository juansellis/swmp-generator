import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/projects/[id]/delete
 * Deletes a project and its dependent rows (via DB CASCADE).
 * Permission: project owner or super_admin only. Uses RPC delete_project for server-side check.
 */
export async function DELETE(_req: Request, { params }: Params) {
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

  const { data, error: rpcError } = await supabase.rpc("delete_project", {
    p_project_id: projectId,
  });

  // Success = no RPC error. Do NOT treat null data as failure (void RPCs return null).
  if (rpcError) {
    console.error("[delete-project] RPC error:", rpcError);
    return NextResponse.json(
      { error: rpcError.message || "Failed to delete project" },
      { status: 500 }
    );
  }

  // Optional: if RPC returns { ok: false, error } use it; otherwise success
  const result = data as { ok?: boolean; error?: string } | null;
  if (result != null && result.ok === false) {
    const msg = result.error ?? "Delete failed";
    const status = msg === "Project not found" ? 404 : msg.includes("Not authorized") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ success: true });
}
