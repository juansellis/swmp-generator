"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  /** Called after successful delete (before redirect). */
  onDeleted?: () => void;
}

const CONFIRM_PLACEHOLDER = 'Type the project name to confirm';

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onDeleted,
}: DeleteProjectDialogProps) {
  const router = useRouter();
  const [confirmText, setConfirmText] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const confirmed = confirmText.trim() === projectName.trim();
  const trimmedName = projectName.trim();

  React.useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  const handleDelete = async () => {
    if (!confirmed || !projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/delete`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = body?.error ?? "Could not delete project";
        console.error("[DeleteProject] delete failed", { status: res.status, body });
        toast.error(msg);
        return;
      }

      // Success: only res.ok matters. Close dialog and show toast immediately.
      toast.success("Project deleted");
      onOpenChange(false);
      setLoading(false);

      // Post-delete: refresh list and navigate in try/catch so failures don't show "delete failed"
      try {
        onDeleted?.();
        router.push("/projects");
        router.refresh();
      } catch (e) {
        console.error("[DeleteProject] post-delete refresh/navigation failed", e);
      }
    } catch (e) {
      console.error("[DeleteProject] request failed", e);
      toast.error(e instanceof Error ? e.message : "Could not delete project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            This is permanent and will remove all associated planning data (inputs, forecast, outputs).
            Type the project name below to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label htmlFor="delete-confirm" className="text-sm font-medium">
            Type <strong>{trimmedName || "project name"}</strong> to confirm
          </Label>
          <Input
            id="delete-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PLACEHOLDER}
            disabled={loading}
            className="mt-2"
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!confirmed || loading}
          >
            {loading ? "Deleting…" : "Delete project"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/*
 * Manual test checklist — Delete project
 * 1. Open /projects, open delete from a project card menu.
 * 2. Type project name, click "Delete project". Expect: "Project deleted" toast, dialog closes, redirect to /projects, project gone from list.
 * 3. Repeat delete on another project; confirm list updates without manual refresh.
 * 4. Trigger a failure (e.g. delete same project again or invalid id). Expect: error toast with API message, no "Project deleted" toast, dialog stays open.
 * 5. Check console: on failure, [DeleteProject] log with status/body or error; no "delete failed" toast when delete actually succeeded.
 */
