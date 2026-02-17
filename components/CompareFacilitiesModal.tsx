"use client";

import * as React from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
export type FacilityForCompare = {
  id: string;
  name: string;
  partner_id: string;
  partner_name: string;
  accepts_stream: boolean;
  distance_km: number | null;
  duration_min: number | null;
};

export interface CompareFacilitiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streamName: string;
  projectId: string;
  /** Effective partner id for this stream (default for partner filter). */
  defaultPartnerId: string | null;
  onSelectFacility: (facilityId: string) => Promise<void>;
  /** When set, Select buttons are disabled (e.g. parent is applying for this stream). */
  applying?: boolean;
  isSuperAdmin?: boolean;
}

export function CompareFacilitiesModal({
  open,
  onOpenChange,
  streamName,
  projectId,
  defaultPartnerId,
  onSelectFacility,
  applying = false,
  isSuperAdmin = false,
}: CompareFacilitiesModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [facilities, setFacilities] = React.useState<FacilityForCompare[]>([]);
  const [partners, setPartners] = React.useState<{ id: string; name: string }[]>([]);
  const [partnerFilter, setPartnerFilter] = React.useState<string>("all");
  const [onlyAccepting, setOnlyAccepting] = React.useState(true);
  const [selectingFacilityId, setSelectingFacilityId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!projectId || !streamName) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/streams/${encodeURIComponent(streamName)}/facilities-for-compare`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load facilities");
      const data = await res.json();
      setFacilities(data.facilities ?? []);
      setPartners(data.partners ?? []);
    } catch {
      setFacilities([]);
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, streamName]);

  React.useEffect(() => {
    if (open) {
      fetchData();
      setPartnerFilter(defaultPartnerId ?? "all");
      setOnlyAccepting(true);
    }
  }, [open, fetchData, defaultPartnerId]);

  const filtered = React.useMemo(() => {
    let list = facilities;
    if (partnerFilter !== "all") {
      list = list.filter((f) => f.partner_id === partnerFilter);
    }
    if (onlyAccepting) {
      list = list.filter((f) => f.accepts_stream);
    }
    return list;
  }, [facilities, partnerFilter, onlyAccepting]);

  const hasPartner = !!(defaultPartnerId?.trim());
  const noFacilities = filtered.length === 0 && !loading;

  const handleSelect = async (facilityId: string) => {
    setSelectingFacilityId(facilityId);
    try {
      await onSelectFacility(facilityId);
      onOpenChange(false);
    } catch {
      // Error surfaced by parent
    } finally {
      setSelectingFacilityId(null);
    }
  };

  const busy = applying || selectingFacilityId != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Facilities for {streamName}</DialogTitle>
        </DialogHeader>

        {!hasPartner && (
          <p className="text-sm text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2">
            Set a Primary Waste Contractor (Project Setup) or choose a Partner for this stream to filter facilities by contractor.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="compare-partner" className="text-xs whitespace-nowrap">Partner</Label>
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger id="compare-partner" className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="All partners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All partners</SelectItem>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={onlyAccepting}
              onChange={(e) => setOnlyAccepting(e.target.checked)}
              className="rounded border-input"
            />
            Only show facilities that accept this stream
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading facilities…</p>
        ) : noFacilities ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="mb-2">No facilities match the current filters.</p>
            {isSuperAdmin && (
              <Link href="/admin/facilities" className="text-primary font-medium hover:underline">
                Add facilities in Admin →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-auto rounded-md border min-h-0 flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[22%]">Facility</TableHead>
                  <TableHead className="w-[18%]">Partner</TableHead>
                  <TableHead className="w-[14%]">Accepts stream</TableHead>
                  <TableHead className="w-[20%]">Distance</TableHead>
                  <TableHead className="w-[26%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-muted-foreground">{f.partner_name || "—"}</TableCell>
                    <TableCell>{f.accepts_stream ? "Yes" : "No"}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {f.distance_km != null
                        ? `${f.distance_km} km${f.duration_min != null ? ` · ${Math.round(f.duration_min)} min` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleSelect(f.id)}
                      >
                        {selectingFacilityId === f.id ? "Applying…" : "Select"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
