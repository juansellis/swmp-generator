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
import { Switch } from "@/components/ui/switch";

type StreamRow = {
  id: string;
  key: string;
  name: string;
  category: string | null;
  default_unit: string;
  default_density_kg_m3: number | null;
  default_kg_per_m: number | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
};

const KEY_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function slugFromKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Sanitise for numeric columns: empty string -> null, parse number, reject NaN or < 0. */
function toNumOrNull(value: string | number | null | undefined): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

/** Sanitise sort_order: non-negative integer. */
function toSortOrder(value: string | number | null | undefined, fallback: number): number {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return n;
}

export default function AdminWasteStreamsPage() {
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<StreamRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    key: "",
    name: "",
    category: "",
    default_density_kg_m3: "" as string | number,
    default_kg_per_m: "" as string | number,
    default_unit: "tonne",
    sort_order: 0,
    notes: "",
  });

  const fetchStreams = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("waste_streams")
      .select("id, key, name, category, default_unit, default_density_kg_m3, default_kg_per_m, is_active, sort_order, notes")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (e) {
      setError(e.message);
      setStreams([]);
    } else {
      setStreams((data ?? []) as StreamRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStreams();
  }, []);

  const openCreate = () => {
    setForm({
      key: "",
      name: "",
      category: "",
      default_density_kg_m3: "",
      default_kg_per_m: "",
      default_unit: "tonne",
      sort_order: streams.length > 0 ? Math.max(...streams.map((s) => s.sort_order)) + 1 : 0,
      notes: "",
    });
    setEditing(null);
    setModalOpen("create");
  };

  const openEdit = (m: StreamRow) => {
    setForm({
      key: m.key,
      name: m.name,
      category: m.category ?? "",
      default_density_kg_m3: m.default_density_kg_m3 ?? "",
      default_kg_per_m: m.default_kg_per_m ?? "",
      default_unit: m.default_unit ?? "",
      sort_order: m.sort_order,
      notes: m.notes ?? "",
    });
    setEditing(m);
    setModalOpen("edit");
  };

  /** Validation for CREATE: requires key (slug) and name. */
  const validateCreate = (): string | null => {
    const key = typeof form.key === "string" ? form.key.trim() : "";
    const name = typeof form.name === "string" ? form.name.trim() : "";
    if (!key) return "Key is required (slug-style, e.g. steel-beam).";
    if (!KEY_SLUG_REGEX.test(key)) return "Key must be slug-style: lowercase letters, numbers, hyphens only.";
    if (!name) return "Name is required.";
    const density = form.default_density_kg_m3 === "" ? null : Number(form.default_density_kg_m3);
    const kgPerM = form.default_kg_per_m === "" ? null : Number(form.default_kg_per_m);
    if (density != null && (Number.isNaN(density) || density < 0)) return "Default density must be ≥ 0.";
    if (kgPerM != null && (Number.isNaN(kgPerM) || kgPerM < 0)) return "Default kg/m must be ≥ 0.";
    return null;
  };

  /** Validation for EDIT: no key. Key is immutable and not in payload. */
  const validateEdit = (): string | null => {
    const name = typeof form.name === "string" ? form.name.trim() : "";
    if (!name) return "Name is required.";
    const density = form.default_density_kg_m3 === "" ? null : Number(form.default_density_kg_m3);
    const kgPerM = form.default_kg_per_m === "" ? null : Number(form.default_kg_per_m);
    if (density != null && (Number.isNaN(density) || density < 0)) return "Default density must be ≥ 0.";
    if (kgPerM != null && (Number.isNaN(kgPerM) || kgPerM < 0)) return "Default kg/m must be ≥ 0.";
    return null;
  };

  const handleSave = async () => {
    const isCreate = modalOpen === "create";
    const err = isCreate ? validateCreate() : validateEdit();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const key = (typeof form.key === "string" ? form.key : "").trim();
    const name = (typeof form.name === "string" ? form.name : "").trim();
    const category = (typeof form.category === "string" ? form.category : "").trim() || null;
    const default_unit = (typeof form.default_unit === "string" ? form.default_unit : "").trim() || "tonne";
    const default_density_kg_m3 = toNumOrNull(form.default_density_kg_m3);
    const default_kg_per_m = toNumOrNull(form.default_kg_per_m);
    const notes = (typeof form.notes === "string" ? form.notes : "").trim() || null;
    const sort_order = toSortOrder(form.sort_order, editing?.sort_order ?? 0);

    if (modalOpen === "create") {
      const payload = {
        key,
        name,
        category,
        default_unit,
        default_density_kg_m3,
        default_kg_per_m,
        sort_order,
        notes,
      };
      const { data, error: e } = await supabase
        .from("waste_streams")
        .insert(payload)
        .select("*")
        .single();
      if (e) {
        toast.error(e.message);
        if (process.env.NODE_ENV === "development") console.error("[waste_streams create]", e);
        setSaving(false);
        return;
      }
      toast.success("Waste stream created");
      setModalOpen(null);
      if (data) setStreams((prev) => [...prev, data as StreamRow].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
    } else if (modalOpen === "edit" && editing) {
      const stream = editing;
      if (!stream?.id) {
        toast.error("Missing waste_stream id");
        setSaving(false);
        return;
      }
      // Edit payload: allowed fields only. Key is immutable and never sent.
      const payload = {
        name,
        category,
        default_unit,
        default_density_kg_m3: default_density_kg_m3 ?? null,
        default_kg_per_m: default_kg_per_m ?? null,
        sort_order,
        notes,
      };
      const res = await fetch(`/api/admin/waste-streams/${stream.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 403 ? "You need super-admin access to update waste streams." : (json?.error ?? res.statusText);
        toast.error(msg);
        setSaving(false);
        return;
      }
      toast.success("Waste stream updated");
      setModalOpen(null);
      setEditing(null);
      if (json && typeof json === "object" && "id" in json) {
        setStreams((prev) => prev.map((s) => (s.id === json.id ? (json as StreamRow) : s)));
      }
    }
    setSaving(false);
  };

  const toggleActive = async (m: StreamRow) => {
    const res = await fetch(`/api/admin/waste-streams/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !m.is_active }),
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = res.status === 403 ? "You need super-admin access." : (json?.error ?? res.statusText);
      toast.error(msg);
      return;
    }
    toast.success(m.is_active ? "Stream disabled" : "Stream enabled");
    if (json && typeof json === "object" && "id" in json) {
      setStreams((prev) => prev.map((s) => (s.id === json.id ? (json as StreamRow) : s)));
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Waste Streams" subtitle="Manage selectable waste streams used across the app." />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Waste Streams"
        subtitle="Canonical list for Inputs, Facilities accepted streams, Forecast allocation, Strategy. Do not change key after create."
        actions={
          <Button variant="outline" size="sm" onClick={openCreate}>
            Create stream
          </Button>
        }
      />
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Waste Streams <Badge variant="secondary">{streams.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Name</TableHead>
                <TableHead className="w-[100px]">Key</TableHead>
                <TableHead className="w-[80px]">Category</TableHead>
                <TableHead className="w-[80px]">Default unit</TableHead>
                <TableHead className="w-[100px]">Density kg/m³</TableHead>
                <TableHead className="w-[80px]">kg/m</TableHead>
                <TableHead className="w-[70px]">Active</TableHead>
                <TableHead className="w-[70px]">Order</TableHead>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {streams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground text-center py-8">
                    No waste streams yet. Run the migration to seed, or create one.
                  </TableCell>
                </TableRow>
              ) : (
                streams.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="font-mono text-xs">{m.key}</TableCell>
                    <TableCell>{m.category ?? "—"}</TableCell>
                    <TableCell>{m.default_unit ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{m.default_density_kg_m3 ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{m.default_kg_per_m ?? "—"}</TableCell>
                    <TableCell>
                      <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} />
                    </TableCell>
                    <TableCell className="tabular-nums">{m.sort_order}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                        Edit
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
            <DialogTitle>{editing ? "Edit waste stream" : "Create waste stream"}</DialogTitle>
            <DialogDescription>
              Key is stable identifier (slug). Do not change after create to avoid breaking references. Density and kg/m ≥ 0.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{editing ? "Key (read-only)" : "Key * (slug)"}</Label>
              {editing ? (
                <p className="font-mono text-sm py-2 px-3 rounded-md bg-muted border border-border">{editing.key}</p>
              ) : (
                <Input
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: slugFromKey(e.target.value) || e.target.value }))}
                  placeholder="e.g. mixed-c-d"
                />
              )}
              {editing && <p className="text-xs text-muted-foreground">Key cannot be changed to avoid breaking existing data.</p>}
            </div>
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Steel beam"
              />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Default unit</Label>
                <Input
                  value={form.default_unit}
                  onChange={(e) => setForm((f) => ({ ...f, default_unit: e.target.value }))}
                  placeholder="e.g. m, m3, t"
                />
              </div>
              <div className="grid gap-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Default density (kg/m³)</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.default_density_kg_m3 === "" ? "" : form.default_density_kg_m3}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      default_density_kg_m3: e.target.value === "" ? "" : e.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label>Default kg/m</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.default_kg_per_m === "" ? "" : form.default_kg_per_m}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      default_kg_per_m: e.target.value === "" ? "" : e.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
