"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { calcWasteKg, calcWasteQty } from "@/lib/forecastApi";
import { FORECAST_UNIT_OPTIONS, WASTE_STREAM_OPTIONS } from "@/lib/forecastConstants";
import {
  getMatchingProjectStream,
  getSuggestedStreamKeyForMaterial,
} from "@/lib/forecastAllocation";
import { inferMaterialType } from "@/lib/forecastInferMaterialType";
import type { WasteStreamTypeRow } from "@/app/api/catalog/waste-stream-types/route";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2Icon, PlusIcon, RefreshCwIcon } from "lucide-react";

export type ForecastItemRow = {
  id: string;
  project_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  excess_percent: number;
  /** When unit = m: kg per metre (required for weight conversion). */
  kg_per_m?: number | null;
  material_type: string | null;
  material_type_id: string | null;
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
  const allocated = (row.waste_stream_key ?? "").trim() !== "";
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
  /** Current project waste stream keys (from latest swmp_inputs) for auto-match and unallocated prompt. */
  projectStreams?: string[];
  /** Allocate row to stream: ensure stream in inputs + set waste_stream_key, then save. */
  onAllocateToStream?: (rowId: string, streamKey: string) => void;
  /** Waste stream types from catalog (Material Type dropdown). Refetch on focus to stay current. */
  wasteStreamTypes?: WasteStreamTypeRow[];
  /** Refetch waste stream types (e.g. when opening Material Type dropdown or clicking Refresh). */
  onRefetchWasteStreamTypes?: () => void;
  /** If true, show "+ Add new waste stream type" in Material Type dropdown. */
  isSuperAdmin?: boolean;
  /** When set, only show items allocated to this waste stream (e.g. from Inputs "View contributing forecast items"). */
  filterStream?: string | null;
  /** Filter displayed rows by allocation/convertibility status. */
  displayFilter?: "all" | "unallocated" | "needs_conversion" | "included";
}

const DEFAULT_ROW: Omit<ForecastItemRow, "id" | "project_id"> = {
  item_name: "",
  quantity: 0,
  unit: "tonne",
  excess_percent: 0,
  kg_per_m: null,
  material_type: null,
  material_type_id: null,
  waste_stream_key: null,
  computed_waste_qty: 0,
  computed_waste_kg: 0,
};

/** Explicit styles for editable table controls so inputs/selects are visible in light and dark. */
const TABLE_CONTROL_CLASS =
  "h-9 px-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 outline-none min-w-0";

export function ForecastTable({
  projectId,
  items,
  onItemsChange,
  saveStatus = "idle",
  disabled = false,
  projectStreams = [],
  onAllocateToStream,
  wasteStreamTypes = [],
  onRefetchWasteStreamTypes,
  isSuperAdmin = false,
  filterStream = null,
  displayFilter = "all",
}: ForecastTableProps) {
  const byStream =
    filterStream != null && filterStream !== ""
      ? items.filter((r) => (r.waste_stream_key ?? "").trim() === filterStream.trim())
      : items;
  const displayItems =
    displayFilter === "all"
      ? byStream
      : byStream.filter((r) => getRowStatus(r) === displayFilter);

  const [addTypeOpen, setAddTypeOpen] = React.useState(false);
  const [newTypeName, setNewTypeName] = React.useState("");
  const [addTypeLoading, setAddTypeLoading] = React.useState(false);
  const [addTypeError, setAddTypeError] = React.useState<string | null>(null);
  const inferTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const INFER_DEBOUNCE_MS = 400;
  const INFER_CONFIDENCE_THRESHOLD = 0.8;

  const addRow = () => {
    const newRow: ForecastItemRow = {
      ...DEFAULT_ROW,
      id: `new-${Date.now()}`,
      project_id: projectId,
      computed_waste_qty: 0,
    };
    onItemsChange([...items, newRow]);
  };

  const updateRow = (id: string, patch: Partial<ForecastItemRow>, options?: { autoAllocate?: boolean }) => {
    const next = items.map((row) => {
      if (row.id !== id) return row;
      const updated = { ...row, ...patch };
      const qty = Number(updated.quantity);
      const excess = Number(updated.excess_percent);
      updated.quantity = Number.isNaN(qty) || qty < 0 ? 0 : qty;
      updated.excess_percent = Number.isNaN(excess) ? 0 : Math.min(100, Math.max(0, excess));
      updated.computed_waste_qty = calcWasteQty(updated.quantity, updated.excess_percent);
      const wasteKg = calcWasteKg(
        updated.quantity,
        updated.excess_percent,
        updated.unit ?? "tonne",
        updated.kg_per_m
      );
      updated.computed_waste_kg = wasteKg != null ? wasteKg : null;
      if (options?.autoAllocate && patch.material_type !== undefined && projectStreams.length > 0) {
        const match = getMatchingProjectStream(updated.material_type, projectStreams);
        if (match) updated.waste_stream_key = match;
      }
      return updated;
    });
    onItemsChange(next);
  };

  const removeRow = (id: string) => {
    onItemsChange(items.filter((r) => r.id !== id));
  };

  const updateRowRef = React.useRef(updateRow);
  updateRowRef.current = updateRow;

  const tryInferMaterialType = React.useCallback((rowId: string, itemName: string) => {
    const result = inferMaterialType(itemName);
    if (!result || result.confidence < INFER_CONFIDENCE_THRESHOLD) return;
    const currentItems = itemsRef.current;
    const row = currentItems.find((r) => r.id === rowId);
    if (!row || row.material_type || row.material_type_id) return;
    const typeByName = new Map((wasteStreamTypes ?? []).map((t) => [t.name, t]));
    const match = typeByName.get(result.materialTypeName);
    if (match) {
      updateRowRef.current(rowId, { material_type_id: match.id, material_type: match.name }, { autoAllocate: true });
    }
  }, [wasteStreamTypes]);

  React.useEffect(() => {
    return () => {
      if (inferTimeoutRef.current) clearTimeout(inferTimeoutRef.current);
    };
  }, []);

  const getQtyError = (q: number) =>
    typeof q !== "number" || Number.isNaN(q) || q < 0 ? "Qty ≥ 0" : null;
  const getExcessError = (e: number) =>
    typeof e !== "number" || Number.isNaN(e) || e < 0 || e > 100 ? "0–100" : null;

  const handleAddNewType = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    setAddTypeLoading(true);
    setAddTypeError(null);
    try {
      const res = await fetch("/api/catalog/waste-stream-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAddTypeError(data?.error ?? "Failed to add");
        return;
      }
      setNewTypeName("");
      setAddTypeOpen(false);
      onRefetchWasteStreamTypes?.();
    } finally {
      setAddTypeLoading(false);
    }
  };

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
          {onRefetchWasteStreamTypes && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefetchWasteStreamTypes}
              disabled={disabled}
              title="Refresh material types"
              aria-label="Refresh material types"
            >
              <RefreshCwIcon className="size-4" />
            </Button>
          )}
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

      <div className="rounded-lg border border-border overflow-x-auto overflow-y-visible">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
              <TableHead className="font-medium px-4 py-3 w-[180px]">Item</TableHead>
              <TableHead className="font-medium px-4 py-3 w-[100px]">Qty</TableHead>
              <TableHead className="font-medium px-4 py-3 w-[90px]">Unit</TableHead>
              <TableHead className="font-medium px-4 py-3 w-[90px]">Excess %</TableHead>
              <TableHead className="font-medium px-4 py-3 w-[140px]">Material Type</TableHead>
              <TableHead className="font-medium px-4 py-3 w-[120px] text-right">Waste (qty / kg)</TableHead>
              <TableHead className="font-medium px-4 py-3 w-[160px]">Stream Allocation</TableHead>
              <TableHead className="font-medium px-4 py-3 w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((row) => {
              const qtyError = getQtyError(row.quantity);
              const excessError = getExcessError(row.excess_percent);
              const computed = calcWasteQty(row.quantity, row.excess_percent);
              return (
                <TableRow
                  key={row.id}
                  className="border-b border-border hover:bg-muted/30"
                >
                  <TableCell className="px-4 py-2.5 align-middle min-w-0">
                    <Input
                      value={row.item_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateRow(row.id, { item_name: value });
                        if (inferTimeoutRef.current) clearTimeout(inferTimeoutRef.current);
                        inferTimeoutRef.current = setTimeout(() => {
                          inferTimeoutRef.current = null;
                          tryInferMaterialType(row.id, value);
                        }, INFER_DEBOUNCE_MS);
                      }}
                      placeholder="Item name"
                      className={cn(TABLE_CONTROL_CLASS, "text-sm w-full")}
                      disabled={disabled}
                      aria-invalid={undefined}
                    />
                  </TableCell>
                  <TableCell className="px-4 py-2.5 align-middle min-w-0">
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
                    {qtyError && (
                      <p className="text-xs text-destructive mt-0.5">{qtyError}</p>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 align-middle min-w-0">
                    <div className="space-y-1.5">
                      <Select
                        value={row.unit || "tonne"}
                        onValueChange={(v) => updateRow(row.id, { unit: v })}
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
                      {(row.unit === "m" || row.unit === "metre" || row.unit === "metres") && (
                        <div>
                          <Label className="text-xs text-muted-foreground">kg per metre</Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={row.kg_per_m != null && row.kg_per_m >= 0 ? row.kg_per_m : ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? null : parseFloat(e.target.value);
                              const val = v != null && !Number.isNaN(v) && v >= 0 ? v : null;
                              updateRow(row.id, { kg_per_m: val });
                            }}
                            placeholder="e.g. 5"
                            className={cn(TABLE_CONTROL_CLASS, "text-sm w-full mt-0.5")}
                            disabled={disabled}
                          />
                          <p className="text-[10px] text-muted-foreground mt-0.5">Required for stream totals</p>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 align-middle min-w-0">
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
                    {excessError && (
                      <p className="text-xs text-destructive mt-0.5">{excessError}</p>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 align-middle min-w-0">
                    {(() => {
                      const typeById = new Map(wasteStreamTypes.map((t) => [t.id, t]));
                      const typeByName = new Map(wasteStreamTypes.map((t) => [t.name, t]));
                      const resolvedId =
                        row.material_type_id && typeById.has(row.material_type_id)
                          ? row.material_type_id
                          : row.material_type && typeByName.has(row.material_type)
                            ? typeByName.get(row.material_type)!.id
                            : null;
                      const isArchived =
                        (row.material_type_id && !typeById.has(row.material_type_id)) ||
                        (row.material_type && !typeByName.has(row.material_type));
                      const displayValue = resolvedId ?? "__none__";

                      return (
                        <div className="space-y-1">
                          <Select
                            value={displayValue}
                            onValueChange={(v) => {
                              if (v === "__add_new__") {
                                setAddTypeOpen(true);
                                return;
                              }
                              if (v === "__none__") {
                                updateRow(row.id, { material_type_id: null, material_type: null }, { autoAllocate: true });
                                return;
                              }
                              const t = typeById.get(v);
                              if (t) {
                                updateRow(
                                  row.id,
                                  { material_type_id: t.id, material_type: t.name },
                                  { autoAllocate: true }
                                );
                              }
                            }}
                            onOpenChange={(open) => {
                              if (open && onRefetchWasteStreamTypes) onRefetchWasteStreamTypes();
                            }}
                            disabled={disabled}
                          >
                            <SelectTrigger className={cn(TABLE_CONTROL_CLASS, "text-sm w-full justify-between !h-9")} size="sm">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {wasteStreamTypes.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                              {isSuperAdmin && (
                                <SelectItem value="__add_new__" className="text-primary font-medium">
                                  + Add new waste stream type
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {isArchived && row.material_type && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              (Archived) {row.material_type} — please reselect
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 align-middle text-right text-sm">
                    <div className="tabular-nums text-muted-foreground">
                      {formatWasteQtyDisplay(computed)} {row.unit || "tonne"}
                    </div>
                    {row.computed_waste_kg != null && row.computed_waste_kg >= 0 ? (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {row.computed_waste_kg.toFixed(2)} kg ({((row.computed_waste_kg ?? 0) / 1000).toFixed(3)} t)
                      </div>
                    ) : (row.quantity > 0 || row.computed_waste_qty > 0) && row.computed_waste_kg == null ? (
                      <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
                        Needs conversion
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 align-middle min-w-0">
                    {(() => {
                      const status = getRowStatus(row);
                      const hasMaterial = !!row.material_type?.trim();
                      const match = hasMaterial ? getMatchingProjectStream(row.material_type, projectStreams) : null;
                      const isAllocated = !!row.waste_stream_key?.trim() && projectStreams.includes(row.waste_stream_key);
                      const showUnallocatedPrompt =
                        hasMaterial && !isAllocated && onAllocateToStream;
                      const suggestedKey = hasMaterial ? getSuggestedStreamKeyForMaterial(row.material_type) : null;

                      const streamOptions =
                        projectStreams.length > 0
                          ? [...projectStreams]
                          : [...WASTE_STREAM_OPTIONS];
                      const withCurrent =
                        row.waste_stream_key && !streamOptions.includes(row.waste_stream_key)
                          ? [row.waste_stream_key, ...streamOptions]
                          : streamOptions;

                      return (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            <Badge
                              variant={status === "unallocated" ? "destructive" : "secondary"}
                              className="font-normal"
                            >
                              {status === "unallocated" ? "Unallocated" : "Allocated"}
                            </Badge>
                            <Badge
                              variant={status === "needs_conversion" ? "outline" : "secondary"}
                              className="font-normal"
                            >
                              {status === "needs_conversion"
                                ? "Needs conversion"
                                : status === "included"
                                  ? "Included in totals"
                                  : "Not in totals"}
                            </Badge>
                          </div>
                          <Select
                            value={row.waste_stream_key ?? "__none__"}
                            onValueChange={(v) =>
                              updateRow(row.id, {
                                waste_stream_key: v === "__none__" ? null : v,
                              })
                            }
                            disabled={disabled}
                          >
                            <SelectTrigger className={cn(TABLE_CONTROL_CLASS, "text-sm w-full justify-between !h-9")} size="sm">
                              <SelectValue placeholder="Unallocated" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Unallocated</SelectItem>
                              {withCurrent.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {showUnallocatedPrompt && (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-muted-foreground shrink-0">
                                No matching waste stream exists for this material.
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() =>
                                    onAllocateToStream(
                                      row.id,
                                      suggestedKey ?? row.material_type ?? "Mixed C&D"
                                    )
                                  }
                                  disabled={disabled}
                                >
                                  Add as Waste Stream
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => onAllocateToStream(row.id, "Mixed C&D")}
                                  disabled={disabled}
                                >
                                  Allocate to Mixed C&D
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(row.id)}
                      disabled={disabled}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove row"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addTypeOpen} onOpenChange={setAddTypeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add waste stream type</DialogTitle>
            <DialogDescription>
              Add a new material type to the catalog. It will appear in the Material Type dropdown for all users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-type-name">Name</Label>
              <Input
                id="new-type-name"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g. Timber (untreated)"
                disabled={addTypeLoading}
              />
            </div>
            {addTypeError && (
              <p className="text-sm text-destructive">{addTypeError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddTypeOpen(false)} disabled={addTypeLoading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddNewType} disabled={!newTypeName.trim() || addTypeLoading}>
              {addTypeLoading ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
