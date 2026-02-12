"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_super_admin: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProfiles = async () => {
    setError(null);
    const res = await fetch("/api/admin/users", { credentials: "include" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? `Request failed (${res.status})`);
      setProfiles([]);
      return;
    }
    const { profiles: data } = await res.json();
    setProfiles(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    setLoading(true);
    fetchProfiles().finally(() => setLoading(false));
  }, []);

  const handleToggleSuperAdmin = async (row: ProfileRow, checked: boolean) => {
    const { error: e } = await supabase
      .from("profiles")
      .update({ is_super_admin: checked })
      .eq("id", row.id);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success(checked ? "Super admin enabled" : "Super admin disabled");
    fetchProfiles();
  };

  const openEditFullName = (row: ProfileRow) => {
    setEditing(row);
    setFullName(row.full_name ?? "");
    setEditModalOpen(true);
  };

  const handleSaveFullName = async () => {
    if (!editing) return;
    setSaving(true);
    const { error: e } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("id", editing.id);
    setSaving(false);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success("Name updated");
    setEditModalOpen(false);
    setEditing(null);
    fetchProfiles();
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Users" subtitle="Profiles (super admin only)." />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="All profiles. Toggle super admin or edit display name (RLS: super admins only)."
      />
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Profiles <Badge variant="secondary">{profiles.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-muted-foreground w-[200px]">ID</TableHead>
                <TableHead className="w-[220px]">Email</TableHead>
                <TableHead className="w-[220px]">Full name</TableHead>
                <TableHead>Super admin</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                    No profiles yet.
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {p.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-sm">{p.email ?? "—"}</TableCell>
                    <TableCell>{p.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={p.is_super_admin}
                        onCheckedChange={(checked) => handleToggleSuperAdmin(p, checked)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEditFullName(p)}>
                        Edit name
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit full name</DialogTitle>
            <DialogDescription>Optional display name for this profile.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Smith"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveFullName} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
