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
import { Textarea } from "@/components/ui/textarea";
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

type PartnerRow = {
  id: string;
  name: string;
  regions: string[];
  partner_type: string;
  notes: string | null;
};

const PARTNER_TYPE_OPTIONS = ["Recycler", "Transfer station", "Processor", "Cleanfill", "Other"];
const REGION_OPTIONS = ["Auckland", "Wellington", "Christchurch", "Hamilton/Waikato", "Tauranga/BOP", "Dunedin/Otago", "Other (NZ)"];

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<"create" | "edit" | "delete" | null>(null);
  const [editing, setEditing] = useState<PartnerRow | null>(null);
  const [deleting, setDeleting] = useState<PartnerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", regions: [] as string[], partner_type: "", notes: "" });

  const fetchPartners = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("partners")
      .select("id, name, regions, partner_type, notes")
      .order("name");
    if (e) {
      setError(e.message);
      setPartners([]);
    } else {
      setPartners((data ?? []) as PartnerRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const openCreate = () => {
    setForm({ name: "", regions: [], partner_type: "", notes: "" });
    setEditing(null);
    setModalOpen("create");
  };
  const openEdit = (p: PartnerRow) => {
    setForm({
      name: p.name,
      regions: p.regions ?? [],
      partner_type: p.partner_type ?? "",
      notes: p.notes ?? "",
    });
    setEditing(p);
    setModalOpen("edit");
  };
  const openDelete = (p: PartnerRow) => {
    setDeleting(p);
    setModalOpen("delete");
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    if (modalOpen === "create") {
      const { error: e } = await supabase.from("partners").insert({
        name: form.name.trim(),
        regions: form.regions,
        partner_type: form.partner_type.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Partner created");
      setModalOpen(null);
      fetchPartners();
    } else if (modalOpen === "edit" && editing) {
      const { error: e } = await supabase
        .from("partners")
        .update({
          name: form.name.trim(),
          regions: form.regions,
          partner_type: form.partner_type.trim() || null,
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Partner updated");
      setModalOpen(null);
      setEditing(null);
      fetchPartners();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    const { error: e } = await supabase.from("partners").delete().eq("id", deleting.id);
    if (e) {
      toast.error(e.message);
      setSaving(false);
      return;
    }
    toast.success("Partner deleted");
    setModalOpen(null);
    setDeleting(null);
    fetchPartners();
    setSaving(false);
  };

  const toggleRegion = (r: string) => {
    setForm((prev) => ({
      ...prev,
      regions: prev.regions.includes(r) ? prev.regions.filter((x) => x !== r) : [...prev.regions, r],
    }));
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Partners" subtitle="Manage partners (companies) from the database." />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Partners"
        subtitle="Manage partners (companies). Create, edit, and delete (RLS-safe)."
        actions={
          <Button variant="outline" size="sm" onClick={openCreate}>
            Add partner
          </Button>
        }
      />
      {error && (
        <p className="text-sm text-destructive mb-2">{error}</p>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Partners <Badge variant="secondary">{partners.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Name</TableHead>
                <TableHead>Regions</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center py-8">
                    No partners yet. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                partners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{(p.regions ?? []).join(", ") || "—"}</TableCell>
                    <TableCell>{p.partner_type || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={p.notes ?? ""}>{p.notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDelete(p)} className="text-destructive hover:text-destructive">
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen === "create" || modalOpen === "edit"} onOpenChange={(open) => !open && setModalOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit partner" : "Add partner"}</DialogTitle>
            <DialogDescription>Partner (company) details. Name is required.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Local metals recycler (Auckland)"
              />
            </div>
            <div className="grid gap-2">
              <Label>Partner type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.partner_type}
                onChange={(e) => setForm((f) => ({ ...f, partner_type: e.target.value }))}
              >
                <option value="">—</option>
                {PARTNER_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Regions</Label>
              <div className="flex flex-wrap gap-2">
                {REGION_OPTIONS.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    variant={form.regions.includes(r) ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => toggleRegion(r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen === "delete"} onOpenChange={(open) => !open && (setModalOpen(null), setDeleting(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete partner</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleting?.name}&quot;? Facilities linked to this partner must be removed or reassigned first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => (setModalOpen(null), setDeleting(null))} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
