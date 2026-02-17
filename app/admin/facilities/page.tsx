"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { STREAM_LABELS } from "@/lib/wasteStreamDefaults";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AddressPicker, type AddressPickerValue } from "@/components/address-picker";

type PartnerRow = { id: string; name: string };
type FacilityRow = {
  id: string;
  partner_id: string;
  name: string;
  facility_type: string;
  region: string;
  accepted_streams: string[];
  address: string | null;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
};

const FACILITY_TYPE_OPTIONS = ["Recycler", "Transfer station", "Processor", "Cleanfill", "Other"];
const REGION_OPTIONS = ["Auckland", "Wellington", "Christchurch", "Hamilton/Waikato", "Tauranga/BOP", "Dunedin/Otago", "Other (NZ)"];

/** Keywords for "Common" quick-select (case-insensitive match against stream label). */
const COMMON_STREAM_KEYWORDS = [
  "Mixed C&D",
  "Timber",
  "Metal",
  "Plasterboard",
  "Cardboard",
  "Concrete",
  "Glass",
  "Soft plastic",
];

/** Keywords for "Recyclables-only" quick-select. */
const RECYCLABLES_STREAM_KEYWORDS = [
  "Metal",
  "Cardboard",
  "Glass",
  "Plasterboard",
  "Timber",
  "Soft plastic",
  "Hard plastic",
  "Mixed C&D",
];

function streamsMatchingKeywords(streamLabels: string[], keywords: string[]): string[] {
  const lower = (s: string) => s.toLowerCase();
  const keyLower = keywords.map(lower);
  return streamLabels.filter((label) =>
    keyLower.some((kw) => lower(label).includes(kw))
  );
}

export default function AdminFacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [streamLabels, setStreamLabels] = useState<string[]>(STREAM_LABELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<"create" | "edit" | "delete" | null>(null);
  const [editing, setEditing] = useState<FacilityRow | null>(null);
  const [deleting, setDeleting] = useState<FacilityRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    partner_id: "",
    name: "",
    facility_type: "",
    region: "",
    address: "",
    place_id: "" as string | undefined,
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    accepted_streams: [] as string[],
  });

  const fetchFacilities = async () => {
    const { data, error: e } = await supabase
      .from("facilities")
      .select("id, partner_id, name, facility_type, region, accepted_streams, address, place_id, lat, lng")
      .order("region")
      .order("name");
    if (e) {
      setError(e.message);
      setFacilities([]);
    } else {
      setFacilities((data ?? []) as FacilityRow[]);
    }
  };

  const fetchPartners = async () => {
    const { data } = await supabase.from("partners").select("id, name").order("name");
    setPartners((data ?? []) as PartnerRow[]);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/catalog/waste-streams");
        if (res.ok) {
          const data = await res.json();
          const names = (data.waste_streams ?? []).map((w: { name: string }) => w.name);
          if (names.length > 0) setStreamLabels(names);
        }
      } catch {
        // keep STREAM_LABELS fallback
      }
      await Promise.all([fetchFacilities(), fetchPartners()]);
      setLoading(false);
    })();
  }, []);

  const openCreate = () => {
    setForm({
      partner_id: partners[0]?.id ?? "",
      name: "",
      facility_type: "",
      region: "",
      address: "",
      place_id: undefined,
      lat: undefined,
      lng: undefined,
      accepted_streams: [],
    });
    setEditing(null);
    setModalOpen("create");
  };
  const openEdit = (f: FacilityRow) => {
    setForm({
      partner_id: f.partner_id,
      name: f.name,
      facility_type: f.facility_type ?? "",
      region: f.region ?? "",
      address: f.address ?? "",
      place_id: f.place_id ?? undefined,
      lat: f.lat ?? undefined,
      lng: f.lng ?? undefined,
      accepted_streams: f.accepted_streams ?? [],
    });
    setEditing(f);
    setModalOpen("edit");
  };
  const openDelete = (f: FacilityRow) => {
    setDeleting(f);
    setModalOpen("delete");
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.partner_id) {
      toast.error("Partner is required");
      return;
    }
    if (!form.place_id || form.lat == null || form.lng == null) {
      toast.error("Address: choose from suggestions to validate.");
      return;
    }
    setSaving(true);
    const validateRes = await fetch("/api/validate-address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ place_id: form.place_id }),
    });
    if (!validateRes.ok) {
      const err = await validateRes.json();
      toast.error(err?.error ?? "Address validation failed.");
      setSaving(false);
      return;
    }
    const serverAddress = (await validateRes.json()) as { formatted_address: string; place_id: string; lat: number; lng: number };
    const payload = {
      partner_id: form.partner_id,
      name: form.name.trim(),
      facility_type: form.facility_type.trim() || null,
      region: form.region.trim() || null,
      accepted_streams: form.accepted_streams,
      address: serverAddress.formatted_address,
      place_id: serverAddress.place_id,
      lat: serverAddress.lat,
      lng: serverAddress.lng,
      updated_at: new Date().toISOString(),
    };
    if (modalOpen === "create") {
      const { error: e } = await supabase.from("facilities").insert(payload);
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Facility created");
      setModalOpen(null);
      fetchFacilities();
    } else if (modalOpen === "edit" && editing) {
      const { error: e } = await supabase.from("facilities").update(payload).eq("id", editing.id);
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Facility updated");
      setModalOpen(null);
      setEditing(null);
      fetchFacilities();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    const { error: e } = await supabase.from("facilities").delete().eq("id", deleting.id);
    if (e) {
      toast.error(e.message);
      setSaving(false);
      return;
    }
    toast.success("Facility deleted");
    setModalOpen(null);
    setDeleting(null);
    fetchFacilities();
    setSaving(false);
  };

  const toggleStream = (s: string) => {
    setForm((prev) => ({
      ...prev,
      accepted_streams: prev.accepted_streams.includes(s)
        ? prev.accepted_streams.filter((x) => x !== s)
        : [...prev.accepted_streams, s],
    }));
  };

  const selectedCount = form.accepted_streams.length;
  const totalCount = streamLabels.length;

  const selectAllStreams = () => {
    setForm((prev) => ({ ...prev, accepted_streams: [...streamLabels] }));
  };
  const selectNoStreams = () => {
    setForm((prev) => ({ ...prev, accepted_streams: [] }));
  };
  const selectCommonStreams = () => {
    setForm((prev) => ({
      ...prev,
      accepted_streams: streamsMatchingKeywords(streamLabels, COMMON_STREAM_KEYWORDS),
    }));
  };
  const selectRecyclablesStreams = () => {
    setForm((prev) => ({
      ...prev,
      accepted_streams: streamsMatchingKeywords(streamLabels, RECYCLABLES_STREAM_KEYWORDS),
    }));
  };

  const partnerName = (id: string) => partners.find((p) => p.id === id)?.name ?? id;

  if (loading) {
    return (
      <>
        <PageHeader title="Facilities" subtitle="Manage facilities (sites) from the database." />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Facilities"
        subtitle="Manage facilities (sites). Partner, region, address, and accepted streams (RLS-safe)."
        actions={
          <Button variant="outline" size="sm" onClick={openCreate} disabled={partners.length === 0}>
            Add facility
          </Button>
        }
      />
      {partners.length === 0 && (
        <p className="text-sm text-amber-600 mb-2">Add at least one partner before adding facilities.</p>
      )}
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Facilities <Badge variant="secondary">{facilities.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Accepted streams</TableHead>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                    No facilities yet. Add a partner first, then add facilities.
                  </TableCell>
                </TableRow>
              ) : (
                facilities.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{partnerName(f.partner_id)}</TableCell>
                    <TableCell>{f.facility_type || "—"}</TableCell>
                    <TableCell>{f.region || "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate" title={f.address ?? ""}>{f.address ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={(f.accepted_streams ?? []).join(", ")}>
                      {(f.accepted_streams ?? []).length} stream(s)
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(f)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => openDelete(f)} className="text-destructive hover:text-destructive">Delete</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen === "create" || modalOpen === "edit"} onOpenChange={(open) => !open && setModalOpen(null)}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => {
            const t = e.target as HTMLElement | null;
            if (!t) return;
            if (t.closest(".pac-container")) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            const t = e.target as HTMLElement | null;
            if (!t) return;
            if (t.closest(".pac-container")) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{editing ? "Edit facility" : "Add facility"}</DialogTitle>
            <DialogDescription>Facility (site) details. Name and partner are required.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Partner *</Label>
              <Select value={form.partner_id} onValueChange={(v) => setForm((f) => ({ ...f, partner_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. C&D transfer station (Auckland)"
              />
            </div>
            <div className="grid gap-2">
              <Label>Facility type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.facility_type}
                onChange={(e) => setForm((f) => ({ ...f, facility_type: e.target.value }))}
              >
                <option value="">—</option>
                {FACILITY_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Region</Label>
              <Select value={form.region || "_"} onValueChange={(v) => setForm((f) => ({ ...f, region: v === "_" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">—</SelectItem>
                  {REGION_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative overflow-visible grid gap-2">
              <Label>Address *</Label>
              <AddressPicker
                value={form.address}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    address: v?.formatted_address ?? "",
                    place_id: v?.place_id,
                    lat: v?.lat,
                    lng: v?.lng,
                  }))
                }
                onInput={(v) =>
                  setForm((f) => ({
                    ...f,
                    address: v,
                    ...(v.trim() ? {} : { place_id: undefined, lat: undefined, lng: undefined }),
                  }))
                }
                placeholder="Search address…"
              />
              <p className="text-xs text-muted-foreground">Choose from suggestions to validate.</p>
            </div>
            <div className="grid gap-2">
              <Label>Accepted streams</Label>
              <p className="text-xs text-muted-foreground">
                Selected: {selectedCount} / {totalCount}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllStreams}>
                  Select all
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={selectNoStreams}>
                  Select none
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={selectCommonStreams}>
                  Quick select: Common
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={selectRecyclablesStreams}>
                  Recyclables only
                </Button>
              </div>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {streamLabels.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <Checkbox
                      id={`stream-${s}`}
                      checked={form.accepted_streams.includes(s)}
                      onCheckedChange={() => toggleStream(s)}
                    />
                    <label htmlFor={`stream-${s}`} className="text-sm cursor-pointer">{s}</label>
                  </div>
                ))}
              </div>
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
            <DialogTitle>Delete facility</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleting?.name}&quot;? This cannot be undone.
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
