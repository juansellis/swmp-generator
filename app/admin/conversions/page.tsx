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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type StreamRow = { id: string; key: string; name: string };
type ConversionRow = {
  id: string;
  waste_stream_id: string;
  from_unit: string;
  to_unit: string;
  factor: number;
  notes: string | null;
  is_active: boolean;
};

export default function AdminConversionsPage() {
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [conversions, setConversions] = useState<(ConversionRow & { stream_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<(ConversionRow & { stream_name?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    waste_stream_id: "",
    from_unit: "",
    to_unit: "kg",
    factor: "",
    notes: "",
  });

  const fetchStreams = async () => {
    const { data } = await supabase
      .from("waste_streams")
      .select("id, key, name")
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    setStreams((data ?? []) as StreamRow[]);
  };

  const fetchConversions = async () => {
    setLoading(true);
    setError(null);
    const { data: convData, error: e } = await supabase
      .from("conversion_factors")
      .select("id, waste_stream_id, from_unit, to_unit, factor, notes, is_active")
      .order("waste_stream_id")
      .order("from_unit");
    if (e) {
      if (e.message.includes("Could not find the table 'public.conversion_factors' in the schema cache")) {
        setConversions([]);
      } else {
        setError(e.message);
        setConversions([]);
      }
      setLoading(false);
      return;
    }
    const streamIds = [...new Set((convData ?? []).map((c: { waste_stream_id: string }) => c.waste_stream_id))];
    const { data: streamData } = await supabase
      .from("waste_streams")
      .select("id, name")
      .in("id", streamIds);
    const nameById = new Map((streamData ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
    setConversions(
      ((convData ?? []).map((c: ConversionRow) => ({
        ...c,
        stream_name: nameById.get(c.waste_stream_id) ?? c.waste_stream_id,
      })))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchStreams();
  }, []);

  useEffect(() => {
    fetchConversions();
  }, []);

  const openCreate = () => {
    setForm({
      waste_stream_id: streams[0]?.id ?? "",
      from_unit: "",
      to_unit: "kg",
      factor: "",
      notes: "",
    });
    setEditing(null);
    setModalOpen("create");
  };

  const openEdit = (c: ConversionRow & { stream_name?: string }) => {
    setForm({
      waste_stream_id: c.waste_stream_id,
      from_unit: c.from_unit,
      to_unit: c.to_unit,
      factor: String(c.factor),
      notes: c.notes ?? "",
    });
    setEditing(c);
    setModalOpen("edit");
  };

  const hasDuplicate = (wasteStreamId: string, fromUnit: string, toUnit: string, excludeId?: string): boolean => {
    return conversions.some(
      (c) =>
        c.is_active &&
        c.waste_stream_id === wasteStreamId &&
        c.from_unit === fromUnit &&
        c.to_unit === toUnit &&
        c.id !== excludeId
    );
  };

  const handleSave = async () => {
    const from_unit = form.from_unit.trim();
    const to_unit = form.to_unit.trim();
    const factorNum = parseFloat(form.factor);
    if (!form.waste_stream_id) {
      toast.error("Waste stream is required");
      return;
    }
    if (!from_unit) {
      toast.error("From unit is required");
      return;
    }
    if (!to_unit) {
      toast.error("To unit is required");
      return;
    }
    if (Number.isNaN(factorNum) || factorNum < 0) {
      toast.error("Factor must be a number ≥ 0");
      return;
    }
    const duplicate = hasDuplicate(form.waste_stream_id, from_unit, to_unit, editing?.id);
    if (duplicate) {
      toast.error("An active factor already exists for this stream and unit pair. Disable it first or choose different units.");
      return;
    }
    setSaving(true);
    if (modalOpen === "create") {
      const { error: e } = await supabase.from("conversion_factors").insert({
        waste_stream_id: form.waste_stream_id,
        from_unit,
        to_unit,
        factor: factorNum,
        notes: form.notes.trim() || null,
      });
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Conversion factor created");
      setModalOpen(null);
      fetchConversions();
    } else if (modalOpen === "edit" && editing) {
      const { error: e } = await supabase
        .from("conversion_factors")
        .update({
          waste_stream_id: form.waste_stream_id,
          from_unit,
          to_unit,
          factor: factorNum,
          notes: form.notes.trim() || null,
        })
        .eq("id", editing.id);
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Conversion factor updated");
      setModalOpen(null);
      setEditing(null);
      fetchConversions();
    }
    setSaving(false);
  };

  const toggleActive = async (c: ConversionRow) => {
    const { error: e } = await supabase
      .from("conversion_factors")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success(c.is_active ? "Factor disabled" : "Factor enabled");
    fetchConversions();
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Conversion factors" subtitle="Per waste stream unit conversion factors (e.g. m → kg, m³ → kg)." />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Conversion factors"
        subtitle="Unit conversion factors (e.g. m → kg, m³ → kg). One active factor per material + from_unit + to_unit."
        actions={
          <Button variant="outline" size="sm" onClick={openCreate} disabled={streams.length === 0}>
            Create factor
          </Button>
        }
      />
      {streams.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
          No active waste streams. Configure waste streams first.
        </p>
      )}
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Conversion factors <Badge variant="secondary">{conversions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Waste stream</TableHead>
                <TableHead className="w-[80px]">From unit</TableHead>
                <TableHead className="w-[80px]">To unit</TableHead>
                <TableHead className="w-[80px]">Factor</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[70px]">Active</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                    No conversion factors yet. Add factors per waste stream (or run the seed migration).
                  </TableCell>
                </TableRow>
              ) : (
                conversions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.stream_name ?? c.waste_stream_id}</TableCell>
                    <TableCell>{c.from_unit}</TableCell>
                    <TableCell>{c.to_unit}</TableCell>
                    <TableCell className="tabular-nums">{c.factor}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={c.notes ?? ""}>
                      {c.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
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
            <DialogTitle>{editing ? "Edit conversion factor" : "Create conversion factor"}</DialogTitle>
            <DialogDescription>
              One active factor per (waste stream, from_unit, to_unit). Duplicate active pairs will be rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Waste stream *</Label>
              <Select
                value={form.waste_stream_id}
                onValueChange={(v) => setForm((f) => ({ ...f, waste_stream_id: v }))}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select waste stream" />
                </SelectTrigger>
                <SelectContent>
                  {streams.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editing && <p className="text-xs text-muted-foreground">Waste stream cannot be changed after create.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>From unit *</Label>
                <Input
                  value={form.from_unit}
                  onChange={(e) => setForm((f) => ({ ...f, from_unit: e.target.value }))}
                  placeholder="e.g. m, m3"
                />
              </div>
              <div className="grid gap-2">
                <Label>To unit *</Label>
                <Input
                  value={form.to_unit}
                  onChange={(e) => setForm((f) => ({ ...f, to_unit: e.target.value }))}
                  placeholder="kg"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Factor *</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.factor}
                onChange={(e) => setForm((f) => ({ ...f, factor: e.target.value }))}
                placeholder="e.g. 12.5 for kg per metre"
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
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
