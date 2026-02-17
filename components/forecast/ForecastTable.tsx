"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { calcWasteKg, calcWasteQty } from "@/lib/forecastApi";
import { FORECAST_UNIT_OPTIONS, WASTE_STREAM_OPTIONS } from "@/lib/forecastConstants";
import { getSuggestedStreamKeyForMaterial } from "@/lib/forecastAllocation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Trash2Icon, PlusIcon, CheckIcon, AlertTriangleIcon } from "lucide-react";

export type ForecastItemRow = {
  id: string;
  project_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  excess_percent: number;
  /** When unit = m: kg per metre (required for weight conversion). */
  kg_per_m?: number | null;
  /** When unit = m3: row override density kg/m³ for conversion. */
  density_kg_m3?: number | null;
  /** Canonical stream (waste_streams.id). */
  allocated_stream_id?: string | null;
  /** Stream name (denormalized for display / backward compat). */
  waste_stream_key: string | null;
  computed_waste_qty: number;
  /** Waste in kg for allocation; null = non-weight or missing conversion. */
  computed_waste_kg?: number | null;
  created_at?: string;
  updated_at?: string;
};

/** Client-side only: new row before insert (id is temp). */
export type ForecastItemEditable = Omit<ForecastItemRow, "computed_waste_qty"> & {
  _temp?: boolean;
};

/** Round waste qty for display only (e.g. 3 decimals). */
function formatWasteQtyDisplay(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

export type RowDisplayStatus = "unallocated" | "needs_conversion" | "included";

function getRowStatus(row: ForecastItemRow): RowDisplayStatus {
  const allocated =
    (row.allocated_stream_id ?? "").trim() !== "" || (row.waste_stream_key ?? "").trim() !== "";
  const convertible =
    row.computed_waste_kg != null &&
    Number.isFinite(row.computed_waste_kg) &&
    row.computed_waste_kg >= 0;
  if (!allocated) return "unallocated";
  if (!convertible) return "needs_conversion";
  return "included";
}

export interface ForecastTableProps {
  projectId: string;
  items: ForecastItemRow[];
  onItemsChange: (items: ForecastItemRow[]) => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  disabled?: boolean;
  /** Current project waste stream names (from swmp_inputs) for "Add stream" prompt. */
  projectStreams?: string[];
  /** Catalog streams (id, name, defaults). Used for dropdown and to auto-fill density/kg_per_m from stream defaults. */
  wasteStreamsCatalog?: {
    id: string;
    name: string;
    default_density_kg_m3?: number | null;
    default_kg_per_m?: number | null;
  }[];
  /** Allocate row to stream: ensure stream in inputs + set allocated_stream_id + waste_stream_key, then save. */
  onAllocateToStream?: (rowId: string, streamId: string, streamName: string) => void;
  /** When set, only show items allocated to this waste stream. */
  filterStream?: string | null;
  displayFilter?: "all" | "unallocated" | "needs_conversion" | "included";
  /** @deprecated Material type UI hidden. */
  wasteStreamTypes?: { id: string; name: string }[];
  materials?: { id: string; name: string; key?: string }[];
  onRefetchWasteStreamTypes?: () => void;
  isSuperAdmin?: boolean;
}

const DEFAULT_ROW: Omit<ForecastItemRow, "id" | "project_id"> = {
  item_name: "",
  quantity: 0,
  unit: "tonne",
  excess_percent: 0,
  kg_per_m: null,
  density_kg_m3: null,
  allocated_stream_id: null,
  waste_stream_key: null,
  computed_waste_qty: 0,
  computed_waste_kg: 0,
};

/** Explicit styles for editable table controls so inputs/selects are visible in light and dark. */
const TABLE_CONTROL_CLASS =
  "h-9 px-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 outline-none min-w-0";

function ForecastTableInner({
  projectId,
  items,
  onItemsChange,
  saveStatus = "idle",
  disabled = false,
  projectStreams = [],
  wasteStreamsCatalog = [],
  onAllocateToStream,
  wasteStreamTypes = [],
  materials,
  onRefetchWasteStreamTypes,
  isSuperAdmin = false,
  filterStream = null,
  displayFilter = "all",
}: ForecastTableProps) {
  const byStream =
    filterStream != null && filterStream !== ""
      ? items.filter(
          (r) =>
            (r.waste_stream_key ?? "").trim() === filterStream.trim() ||
            (r.allocated_stream_id && wasteStreamsCatalog.find((s) => s.id === r.allocated_stream_id)?.name === filterStream)
        )
      : items;
  const displayItems =
    displayFilter === "all"
      ? byStream
      : byStream.filter((r) => getRowStatus(r) === displayFilter);

  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const addRow = () => {
    const newRow: ForecastItemRow = {
      ...DEFAULT_ROW,
      id: `new-${Date.now()}`,
      project_id: projectId,
      computed_waste_qty: 0,
    };
    onItemsChange([...items, newRow]);
  };

  const updateRow = (id: string, patch: Partial<ForecastItemRow>) => {
    const next = items.map((row) => {
      if (row.id !== id) return row;
      const updated = { ...row, ...patch };
      const qty = Number(updated.quantity);
      const excess = Number(updated.excess_percent);
      updated.quantity = Number.isNaN(qty) || qty < 0 ? 0 : qty;
      updated.excess_percent = Number.isNaN(excess) ? 0 : Math.min(100, Math.max(0, excess));
      updated.computed_waste_qty = calcWasteQty(updated.quantity, updated.excess_percent);
      const stream = wasteStreamsCatalog?.find((s) => s.id === updated.allocated_stream_id);
      const effectiveDensity =
        updated.density_kg_m3 != null && Number.isFinite(updated.density_kg_m3) && updated.density_kg_m3 > 0
          ? updated.density_kg_m3
          : (stream?.default_density_kg_m3 != null && Number.isFinite(stream.default_density_kg_m3) && stream.default_density_kg_m3 > 0 ? stream.default_density_kg_m3 : null);
      const effectiveKgPerM =
        updated.kg_per_m != null && Number.isFinite(updated.kg_per_m) && updated.kg_per_m >= 0
          ? updated.kg_per_m
          : (stream?.default_kg_per_m != null && Number.isFinite(stream.default_kg_per_m) && stream.default_kg_per_m >= 0 ? stream.default_kg_per_m : null);
      const wasteKg = calcWasteKg(
        updated.quantity,
        updated.excess_percent,
        updated.unit ?? "tonne",
        effectiveKgPerM ?? undefined,
        effectiveDensity ?? undefined
      );
      updated.computed_waste_kg = wasteKg != null ? wasteKg : null;
      return updated;
    });
    onItemsChange(next);
  };

  const removeRow = (id: string) => {
    onItemsChange(items.filter((r) => r.id !== id));
  };

  const updateRowRef = React.useRef(updateRow);
  updateRowRef.current = updateRow;

  // Material type inference removed; allocation is via waste_stream_key only.

  const getQtyError = (q: number) =>
    typeof q !== "number" || Number.isNaN(q) || q < 0 ? "Qty ≥ 0" : null;
  const getExcessError = (e: number) =>
    typeof e !== "number" || Number.isNaN(e) || e < 0 || e > 100 ? "0–100" : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={addRow}
            disabled={disabled}
            className="shrink-0"
          >
            <PlusIcon className="size-4 mr-2" />
            Add Forecast Item
          </Button>
        </div>
        {saveStatus !== "idle" && (
          <span
            className={cn(
              "text-xs",
              saveStatus === "saving" && "text-muted-foreground",
              saveStatus === "saved" && "text-emerald-600 dark:text-emerald-400",
              saveStatus === "error" && "text-destructive"
            )}
          >
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && "Save failed"}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border min-w-0 overflow-hidden">
        <Table className="table-fixed w-full text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
              <TableHead className="w-[40%] font-medium px-3 py-3">Item</TableHead>
              <TableHead className="w-[18%] font-medium px-3 py-3">Qty</TableHead>
              <TableHead className="w-[12%] font-medium px-3 py-3">Unit</TableHead>
              <TableHead className="w-[10%] font-medium px-3 py-3">Waste %</TableHead>
              <TableHead className="w-[20%] font-medium px-3 py-3 text-right">Stream</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((row) => {
              const qtyError = getQtyError(row.quantity);
              const excessError = getExcessError(row.excess_percent);
              const computed = calcWasteQty(row.quantity, row.excess_percent);
              const status = getRowStatus(row);
              const streamName = row.waste_stream_key ?? wasteStreamsCatalog.find((s) => s.id === row.allocated_stream_id)?.name ?? null;
              const isAllocated = (row.allocated_stream_id ?? "").trim() !== "" || (streamName ?? "").trim() !== "";
              const showUnallocatedPrompt = !isAllocated && onAllocateToStream && wasteStreamsCatalog.length > 0;
              const suggestedStream = row.item_name?.trim()
                ? wasteStreamsCatalog.find((s) => getSuggestedStreamKeyForMaterial(row.item_name) === s.name)
                : wasteStreamsCatalog.find((s) => s.name === "Mixed C&D");
              const streamOptions = wasteStreamsCatalog.length > 0 ? wasteStreamsCatalog : WASTE_STREAM_OPTIONS.map((name) => ({ id: name, name }));
              const streamSelectValue =
                wasteStreamsCatalog.length > 0
                  ? (row.allocated_stream_id ?? "__none__")
                  : (row.waste_stream_key ?? row.allocated_stream_id ?? "__none__");

              return (
                <TableRow
                  key={row.id}
                  className="border-b border-border hover:bg-muted/30"
                >
                  <TableCell className="px-3 py-4 align-middle min-w-0 w-[40%]">
                    <Input
                      value={row.item_name}
                      onChange={(e) => updateRow(row.id, { item_name: e.target.value })}
                      placeholder="Item name"
                      className={cn(TABLE_CONTROL_CLASS, "text-sm w-full")}
                      disabled={disabled}
                      aria-invalid={undefined}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-4 align-middle min-w-0 w-[18%]">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={row.quantity === 0 ? "" : row.quantity}
                      onChange={(e) => {
                        const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                        const clamped = Number.isNaN(v) || v < 0 ? 0 : v;
                        updateRow(row.id, { quantity: clamped });
                      }}
                      placeholder="0"
                      className={cn(
                        TABLE_CONTROL_CLASS,
                        "text-sm w-full tabular-nums",
                        qtyError && "border-destructive aria-invalid"
                      )}
                      disabled={disabled}
                      aria-invalid={!!qtyError}
                    />
                    {qtyError && <p className="text-xs text-destructive mt-0.5">{qtyError}</p>}
                  </TableCell>
                  <TableCell className="px-3 py-4 align-middle min-w-0 w-[12%]">
                    <Select
                      value={row.unit || "tonne"}
                      onValueChange={(v) => {
                        const stream = wasteStreamsCatalog?.find((s) => s.id === row.allocated_stream_id);
                        const patch: Partial<ForecastItemRow> = { unit: v };
                        if (v === "m3" || v === "m³") {
                          if ((row.density_kg_m3 == null || !Number.isFinite(row.density_kg_m3) || row.density_kg_m3 <= 0) && stream?.default_density_kg_m3 != null && Number.isFinite(stream.default_density_kg_m3)) {
                            patch.density_kg_m3 = stream.default_density_kg_m3;
                          }
                        } else if (v === "m" || v === "metre" || v === "metres") {
                          if ((row.kg_per_m == null || !Number.isFinite(row.kg_per_m) || row.kg_per_m < 0) && stream?.default_kg_per_m != null && Number.isFinite(stream.default_kg_per_m)) {
                            patch.kg_per_m = stream.default_kg_per_m;
                          }
                        }
                        updateRow(row.id, patch);
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className={cn(TABLE_CONTROL_CLASS, "text-sm w-full justify-between !h-9")} size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORECAST_UNIT_OPTIONS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(row.unit === "m" || row.unit === "metre" || row.unit === "metres") && (() => {
                      const streamForRow = wasteStreamsCatalog?.find((s) => s.id === row.allocated_stream_id);
                      const effectiveKgPerM = row.kg_per_m != null && row.kg_per_m >= 0 ? row.kg_per_m : (streamForRow?.default_kg_per_m ?? null);
                      return (
                      <div className="mt-1.5 flex items-center gap-1">
                        <Label className="text-[10px] text-muted-foreground shrink-0">kg/m</Label>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={effectiveKgPerM != null && effectiveKgPerM >= 0 ? effectiveKgPerM : ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : parseFloat(e.target.value);
                            const val = v != null && !Number.isNaN(v) && v >= 0 ? v : null;
                            updateRow(row.id, { kg_per_m: val });
                          }}
                          placeholder="e.g. 5"
                          className={cn(TABLE_CONTROL_CLASS, "text-xs flex-1 min-w-0")}
                          disabled={disabled}
                        />
                      </div>
                    ); })()}
                    {(row.unit === "m3" || row.unit === "m³") && (() => {
                      const streamForRow = wasteStreamsCatalog?.find((s) => s.id === row.allocated_stream_id);
                      const effectiveDensity = row.density_kg_m3 != null && row.density_kg_m3 > 0 ? row.density_kg_m3 : (streamForRow?.default_density_kg_m3 ?? null);
                      return (
                      <div className="mt-1.5 flex items-center gap-1">
                        <Label className="text-[10px] text-muted-foreground shrink-0">kg/m³</Label>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={effectiveDensity != null && effectiveDensity > 0 ? effectiveDensity : ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : parseFloat(e.target.value);
                            const val = v != null && !Number.isNaN(v) && v > 0 ? v : null;
                            updateRow(row.id, { density_kg_m3: val });
                          }}
                          placeholder="e.g. 1200"
                          className={cn(TABLE_CONTROL_CLASS, "text-xs flex-1 min-w-0")}
                          disabled={disabled}
                        />
                      </div>
                    ); })()}
                  </TableCell>
                  <TableCell className="px-3 py-4 align-middle min-w-0 w-[10%]">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={row.excess_percent === 0 ? "" : row.excess_percent}
                      onChange={(e) => {
                        const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                        const clamped = Number.isNaN(v) ? 0 : Math.min(100, Math.max(0, v));
                        updateRow(row.id, { excess_percent: clamped });
                      }}
                      onBlur={() => {
                        const v = row.excess_percent;
                        const clamped = !Number.isFinite(v) ? 0 : Math.min(100, Math.max(0, v));
                        if (clamped !== v) updateRow(row.id, { excess_percent: clamped });
                      }}
                      placeholder="0"
                      className={cn(
                        TABLE_CONTROL_CLASS,
                        "text-sm w-full tabular-nums",
                        excessError && "border-destructive aria-invalid"
                      )}
                      disabled={disabled}
                      aria-invalid={!!excessError}
                    />
                    {excessError && <p className="text-xs text-destructive mt-0.5">{excessError}</p>}
                  </TableCell>
                  <TableCell className="px-3 py-4 align-middle text-right w-[20%]">
                    <div className="flex flex-col items-end gap-2">
                      {status === "included" && (
                        <Badge variant="default" className="text-[10px] font-normal bg-emerald-600 text-white gap-1">
                          <CheckIcon className="size-3" /> Included
                        </Badge>
                      )}
                      {status === "unallocated" && (
                        <Badge variant="secondary" className="text-[10px] font-normal text-amber-700 dark:text-amber-400 border-amber-300 gap-1">
                          <AlertTriangleIcon className="size-3" /> Unallocated
                        </Badge>
                      )}
                      {status === "needs_conversion" && (
                        <Badge variant="secondary" className="text-[10px] font-normal text-orange-600 dark:text-orange-400 gap-1">
                          <AlertTriangleIcon className="size-3" /> Needs conversion
                        </Badge>
                      )}
                      <Select
                        value={streamSelectValue}
                        onValueChange={(v) => {
                          if (v === "__none__") {
                            updateRow(row.id, { allocated_stream_id: null, waste_stream_key: null });
                            return;
                          }
                          const stream = streamOptions.find((s) => s.id === v || s.name === v);
                          const id = stream ? stream.id : v;
                          const name = stream ? stream.name : v;
                          const patch: Partial<ForecastItemRow> = { allocated_stream_id: wasteStreamsCatalog.length > 0 ? id : null, waste_stream_key: name };
                          const u = (row.unit ?? "tonne").toLowerCase();
                          if (stream && "default_density_kg_m3" in stream) {
                            if ((u === "m3" || u === "m³") && (row.density_kg_m3 == null || !Number.isFinite(row.density_kg_m3) || row.density_kg_m3 <= 0) && stream.default_density_kg_m3 != null && Number.isFinite(stream.default_density_kg_m3)) {
                              patch.density_kg_m3 = stream.default_density_kg_m3;
                            }
                            if ((u === "m" || u === "metre" || u === "metres") && (row.kg_per_m == null || !Number.isFinite(row.kg_per_m) || row.kg_per_m < 0) && stream.default_kg_per_m != null && Number.isFinite(stream.default_kg_per_m)) {
                              patch.kg_per_m = stream.default_kg_per_m;
                            }
                          }
                          updateRow(row.id, patch);
                        }}
                        disabled={disabled}
                      >
                        <SelectTrigger className={cn(TABLE_CONTROL_CLASS, "text-sm w-full max-w-[180px] justify-between !h-9")} size="sm">
                          <SelectValue placeholder="Select stream" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unallocated</SelectItem>
                          {streamOptions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="tabular-nums text-xs text-muted-foreground text-right">
                        <div>{formatWasteQtyDisplay(computed)} {row.unit || "tonne"}</div>
                        {row.computed_waste_kg != null && row.computed_waste_kg >= 0 ? (
                          <div>{(row.computed_waste_kg / 1000).toFixed(3)} t</div>
                        ) : (row.quantity > 0 || row.computed_waste_qty > 0) && row.computed_waste_kg == null ? (
                          <span className="text-orange-600 dark:text-orange-400">Needs conversion</span>
                        ) : null}
                      </div>
                      {showUnallocatedPrompt && (
                        <div className="flex flex-wrap justify-end gap-1.5 text-xs">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              const s = suggestedStream ?? wasteStreamsCatalog[0];
                              if (s) onAllocateToStream?.(row.id, s.id, s.name);
                            }}
                            disabled={disabled}
                          >
                            Add stream
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              const mixed = wasteStreamsCatalog.find((s) => s.name === "Mixed C&D") ?? wasteStreamsCatalog[0];
                              if (mixed) onAllocateToStream?.(row.id, mixed.id, mixed.name);
                            }}
                            disabled={disabled}
                          >
                            Mixed C&D
                          </Button>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(row.id)}
                        disabled={disabled}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="Remove row"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}

export const ForecastTable = React.memo(ForecastTableInner);
