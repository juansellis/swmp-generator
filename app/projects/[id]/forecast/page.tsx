"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useProjectContext } from "../project-context";
import { supabase } from "@/lib/supabaseClient";
import { calcWasteKg, calcWasteQty } from "@/lib/forecastApi";
import {
  applyForecastToInputs,
  ensureStreamInInputs,
} from "@/lib/forecastAllocation";
import { defaultSwmpInputs, normalizeSwmpInputs, SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProjectHeader } from "@/components/project-header";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/notice";
import { InputsSectionCard } from "@/components/inputs/section-card";
import { ForecastTable, type ForecastItemRow } from "@/components/forecast/ForecastTable";
import { ForecastSummary } from "@/components/forecast/ForecastSummary";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Recycle, PlusIcon, AlertTriangleIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const MIXED_CD_KEY = "Mixed C&D";

type FilterStatus = "all" | "unallocated" | "needs_conversion" | "included";

function getItemStatus(row: ForecastItemRow): "unallocated" | "needs_conversion" | "included" {
  const allocated = (row.waste_stream_key ?? "").trim() !== "";
  const convertible = row.computed_waste_kg != null && Number.isFinite(row.computed_waste_kg) && row.computed_waste_kg >= 0;
  if (!allocated) return "unallocated";
  if (!convertible) return "needs_conversion";
  return "included";
}

export default function ProjectForecastPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params?.id ?? null;
  const filterStream = searchParams?.get("stream") ?? null;
  const filterFromUrl = searchParams?.get("filter") as FilterStatus | null;
  const ctx = useProjectContext();
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>(
    filterFromUrl && ["all", "unallocated", "needs_conversion", "included"].includes(filterFromUrl)
      ? filterFromUrl
      : "all"
  );
  React.useEffect(() => {
    if (filterFromUrl && ["all", "unallocated", "needs_conversion", "included"].includes(filterFromUrl)) {
      setFilterStatus(filterFromUrl);
    }
  }, [filterFromUrl]);
  const [allocateAllOpen, setAllocateAllOpen] = React.useState(false);
  const [allocateAllLoading, setAllocateAllLoading] = React.useState(false);

  const project = ctx?.project ?? null;
  const projectLoading = ctx?.projectLoading ?? true;
  const projectError = ctx?.projectError ?? null;
  const setForecastCount = ctx?.setForecastCount;

  const [items, setItems] = React.useState<ForecastItemRow[]>([]);
  const [serverItemIds, setServerItemIds] = React.useState<Set<string>>(new Set());
  const [projectStreams, setProjectStreams] = React.useState<string[]>([]);
  const [wasteStreamTypes, setWasteStreamTypes] = React.useState<
    { id: string; name: string; category: string | null; sort_order: number }[]
  >([]);
  const [itemsLoading, setItemsLoading] = React.useState(true);
  const [itemsError, setItemsError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { unallocatedCount, needsConversionCount, includedCount } = React.useMemo(() => {
    let unallocated = 0, needsConversion = 0, included = 0;
    for (const row of items) {
      const status = getItemStatus(row);
      if (status === "unallocated") unallocated++;
      else if (status === "needs_conversion") needsConversion++;
      else included++;
    }
    return { unallocatedCount: unallocated, needsConversionCount: needsConversion, includedCount: included };
  }, [items]);

  const filteredItems = React.useMemo(() => {
    if (filterStatus === "all") return items;
    return items.filter((row) => getItemStatus(row) === filterStatus);
  }, [items, filterStatus]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/check-admin", { credentials: "include" })
      .then((r) => r.json())
      .then((body: { isSuperAdmin?: boolean }) => {
        if (!cancelled && typeof body?.isSuperAdmin === "boolean") setIsSuperAdmin(body.isSuperAdmin);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchWasteStreamTypes = React.useCallback(async () => {
    const res = await fetch("/api/catalog/waste-stream-types", { credentials: "include" });
    if (!res.ok) return;
    const body = (await res.json()) as { waste_stream_types?: { id: string; name: string; category: string | null; sort_order: number }[] };
    if (Array.isArray(body?.waste_stream_types)) {
      setWasteStreamTypes(body.waste_stream_types);
    }
  }, []);

  const loadItems = React.useCallback(async () => {
    if (!projectId) return;
    if (process.env.NODE_ENV === "development") {
      console.time("[perf] forecast items fetch");
    }
    setItemsLoading(true);
    setItemsError(null);
    const [itemsRes, inputsRes, _] = await Promise.all([
      supabase
        .from("project_forecast_items")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase
        .from("swmp_inputs")
        .select(SWMP_INPUTS_JSON_COLUMN)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetch("/api/catalog/waste-stream-types", { credentials: "include" })
        .then((r) => r.json())
        .then((body: { waste_stream_types?: { id: string; name: string; category: string | null; sort_order: number }[] }) => {
          if (Array.isArray(body?.waste_stream_types)) setWasteStreamTypes(body.waste_stream_types);
        })
        .catch(() => {}),
    ]);

    if (itemsRes.error) {
      setItemsError(itemsRes.error.message);
      setItems([]);
      setServerItemIds(new Set());
    } else {
      const rows = (itemsRes.data ?? []) as ForecastItemRow[];
      setItems(rows);
      setServerItemIds(new Set(rows.map((r) => r.id)));
      setForecastCount?.(rows.length);
    }

    if (inputsRes.data?.[SWMP_INPUTS_JSON_COLUMN as keyof typeof inputsRes.data]) {
      const raw = inputsRes.data[SWMP_INPUTS_JSON_COLUMN as keyof typeof inputsRes.data];
      const inputs = normalizeSwmpInputs(raw);
      setProjectStreams(inputs.waste_streams ?? []);
    } else {
      setProjectStreams([]);
    }
    setItemsLoading(false);
    if (process.env.NODE_ENV === "development") {
      console.timeEnd("[perf] forecast items fetch");
    }
  }, [projectId, setForecastCount]);

  // Initial load when projectId is set. Autosave does not call loadItems (no refetch after save).
  React.useEffect(() => {
    if (projectId) loadItems();
  }, [projectId, loadItems]);

  /** Sync forecast quantities to latest swmp_inputs (idempotent: recompute forecast_qty from items). */
  const syncForecastToInputs = React.useCallback(
    async (forecastItems: ForecastItemRow[]) => {
      if (!projectId) return;
      const { data: row, error: fetchErr } = await supabase
        .from("swmp_inputs")
        .select("id, " + SWMP_INPUTS_JSON_COLUMN)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr || !row) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[forecast] syncForecastToInputs: no inputs row", fetchErr?.message);
        }
        return;
      }

      const inputsRow = row as unknown as { id: string; [k: string]: unknown };
      const raw = inputsRow[SWMP_INPUTS_JSON_COLUMN];
      const inputs = normalizeSwmpInputs(raw ?? {});
      const updated = applyForecastToInputs(inputs, forecastItems);
      const { error: updateErr } = await supabase
        .from("swmp_inputs")
        .update({ [SWMP_INPUTS_JSON_COLUMN]: updated })
        .eq("id", inputsRow.id);

      if (updateErr && process.env.NODE_ENV === "development") {
        console.warn("[forecast] syncForecastToInputs failed", updateErr);
      }
    },
    [projectId]
  );

  /** Ensure a stream exists in project inputs (add if missing), then save. Updates projectStreams. */
  const ensureStreamAndSave = React.useCallback(
    async (streamKey: string) => {
      if (!projectId) return;
      const { data: row, error: fetchErr } = await supabase
        .from("swmp_inputs")
        .select("id, " + SWMP_INPUTS_JSON_COLUMN)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let inputs = fetchErr || !row ? null : normalizeSwmpInputs((row as unknown as Record<string, unknown>)[SWMP_INPUTS_JSON_COLUMN] ?? {});
      if (!inputs) inputs = defaultSwmpInputs(projectId);
      const next = ensureStreamInInputs(inputs, streamKey);
      const streamAdded = (next.waste_streams?.length ?? 0) > (inputs?.waste_streams?.length ?? 0);
      if (!streamAdded) {
        setProjectStreams(next.waste_streams ?? []);
        return;
      }
      const rowId = !fetchErr && row && typeof (row as unknown as { id?: string }).id === "string" ? (row as unknown as { id: string }).id : null;
      if (rowId) {
        await supabase.from("swmp_inputs").update({ [SWMP_INPUTS_JSON_COLUMN]: next }).eq("id", rowId);
      } else {
        await supabase.from("swmp_inputs").insert({ project_id: projectId, [SWMP_INPUTS_JSON_COLUMN]: next });
      }
      setProjectStreams(next.waste_streams ?? []);
    },
    [projectId]
  );

  const saveItems = React.useCallback(
    async (nextItems: ForecastItemRow[]) => {
      if (!projectId) return;
      setSaveStatus("saving");
      const toInsert = nextItems.filter((i) => String(i.id).startsWith("new-"));
      const toUpdate = nextItems.filter(
        (i) => !String(i.id).startsWith("new-") && serverItemIds.has(i.id)
      );
      const toDelete = [...serverItemIds].filter(
        (id) => !nextItems.some((i) => i.id === id)
      );

      const insertedIdMap: { tempId: string; realId: string }[] = [];

      try {
        for (const id of toDelete) {
          await supabase.from("project_forecast_items").delete().eq("id", id);
        }
        for (const row of toInsert) {
          const wasteInUnit = calcWasteQty(
            Number(row.quantity),
            Number(row.excess_percent) ?? 0
          );
          const wasteKg = calcWasteKg(
            Number(row.quantity),
            Number(row.excess_percent) ?? 0,
            row.unit || "tonne",
            row.kg_per_m
          );
          const payload = {
            project_id: projectId,
            item_name: row.item_name || "",
            quantity: Number(row.quantity) ?? 0,
            unit: row.unit || "tonne",
            excess_percent: Number(row.excess_percent) ?? 0,
            kg_per_m: row.kg_per_m != null && Number.isFinite(row.kg_per_m) ? row.kg_per_m : null,
            material_type: row.material_type || null,
            material_type_id: row.material_type_id || null,
            waste_stream_key: row.waste_stream_key || null,
            computed_waste_qty: wasteInUnit,
            // Canonical weight for allocations; omit so DB default 0 applies, or set explicitly
            ...(wasteKg != null && Number.isFinite(wasteKg) ? { computed_waste_kg: wasteKg } : {}),
          };
          if (process.env.NODE_ENV === "development") {
            console.log("[forecast] insert payload", { projectId, payload });
          }
          const { data: inserted, error: insertErr } = await supabase
            .from("project_forecast_items")
            .insert(payload)
            .select("id")
            .single();
          if (insertErr) {
            const errOutput = {
              message: insertErr.message,
              details: (insertErr as { details?: string }).details,
              hint: (insertErr as { hint?: string }).hint,
              code: (insertErr as { code?: string }).code,
            };
            if (process.env.NODE_ENV === "development") {
              console.error("[forecast] insert error", {
                projectId,
                payload,
                supabaseError: errOutput,
                raw: insertErr,
              });
            }
            throw { ...insertErr, __errOutput: errOutput };
          }
          if (inserted?.id) {
            insertedIdMap.push({ tempId: row.id, realId: inserted.id });
          }
        }
        for (const row of toUpdate) {
          const wasteInUnit = calcWasteQty(
            Number(row.quantity),
            Number(row.excess_percent) ?? 0
          );
          const wasteKg = calcWasteKg(
            Number(row.quantity),
            Number(row.excess_percent) ?? 0,
            row.unit || "tonne",
            row.kg_per_m
          );
          const payload = {
            item_name: row.item_name,
            quantity: row.quantity,
            unit: row.unit,
            excess_percent: row.excess_percent,
            kg_per_m: row.kg_per_m != null && Number.isFinite(row.kg_per_m) ? row.kg_per_m : null,
            material_type: row.material_type,
            material_type_id: row.material_type_id,
            waste_stream_key: row.waste_stream_key,
            computed_waste_qty: wasteInUnit,
            ...(wasteKg != null && Number.isFinite(wasteKg) ? { computed_waste_kg: wasteKg } : { computed_waste_kg: null }),
          };
          const { error: updateErr } = await supabase
            .from("project_forecast_items")
            .update(payload)
            .eq("id", row.id);
          if (updateErr) {
            const errOutput = {
              message: updateErr.message,
              details: (updateErr as { details?: string }).details,
              hint: (updateErr as { hint?: string }).hint,
              code: (updateErr as { code?: string }).code,
            };
            if (process.env.NODE_ENV === "development") {
              console.error("[forecast] update error", {
                projectId,
                itemId: row.id,
                payload,
                supabaseError: errOutput,
                raw: updateErr,
              });
            }
            throw { ...updateErr, __errOutput: errOutput };
          }
        }

        setForecastCount?.(nextItems.length);
        await syncForecastToInputs(nextItems);

        if (insertedIdMap.length > 0) {
          const byTemp = new Map(insertedIdMap.map((x) => [x.tempId, x.realId]));
          setItems((prev) =>
            prev.map((r) => {
              const realId = byTemp.get(r.id);
              return realId ? { ...r, id: realId } : r;
            })
          );
          setServerItemIds((prev) =>
            new Set([...prev, ...insertedIdMap.map((x) => x.realId)])
          );
        }

        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err: unknown) {
        setSaveStatus("error");
        const errOutput =
          err && typeof err === "object" && "__errOutput" in err
            ? (err as { __errOutput: { message?: string; details?: string; hint?: string; code?: string } }).__errOutput
            : null;
        const msg =
          err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
            ? (err as { message: string }).message
            : errOutput?.message ?? null;
        if (process.env.NODE_ENV === "development") {
          console.error("[forecast] saveItems error", {
            err,
            errOutput,
            message: msg,
          });
          toast.error(msg ? `Forecast error: ${msg}` : "Could not update forecast — try again.");
        } else {
          toast.error("Could not update forecast — try again.");
        }
        loadItems();
      }
    },
    [projectId, serverItemIds, setForecastCount, syncForecastToInputs]
  );

  const handleItemsChange = React.useCallback(
    (nextItems: ForecastItemRow[]) => {
      setItems(nextItems);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        saveItems(nextItems);
      }, 500);
    },
    [saveItems]
  );

  /** Allocate a row to a stream: ensure stream in inputs, set row's waste_stream_key, then save. */
  const handleAllocateToStream = React.useCallback(
    async (rowId: string, streamKey: string) => {
      await ensureStreamAndSave(streamKey);
        const next = items.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, waste_stream_key: streamKey };
        updated.computed_waste_qty = calcWasteQty(
          Number(r.quantity),
          Number(r.excess_percent) ?? 0
        );
        updated.computed_waste_kg = calcWasteKg(
          Number(r.quantity),
          Number(r.excess_percent) ?? 0,
          r.unit ?? "tonne",
          r.kg_per_m
        ) ?? null;
        return updated;
      });
      setItems(next);
      saveItems(next);
    },
    [items, ensureStreamAndSave, saveItems]
  );

  const handleAllocateAllUnallocated = React.useCallback(async () => {
    if (!projectId) return;
    setAllocateAllLoading(true);
    try {
      await ensureStreamAndSave(MIXED_CD_KEY);
      const updated = items.map((row) =>
        getItemStatus(row) === "unallocated"
          ? { ...row, waste_stream_key: MIXED_CD_KEY }
          : row
      );
      setItems(updated);
      await saveItems(updated);
      setAllocateAllOpen(false);
      toast.success("All unallocated items allocated to Mixed C&D.");
    } catch (e) {
      console.error("[forecast] allocate all unallocated", e);
      toast.error("Could not allocate all — try again.");
    } finally {
      setAllocateAllLoading(false);
    }
  }, [projectId, items, ensureStreamAndSave, saveItems]);

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  if (projectId && !ctx) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">Loading project…</p>
        </div>
      </AppShell>
    );
  }

  if (projectLoading && !project) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </AppShell>
    );
  }

  if (projectError || !project) {
    return (
      <AppShell>
        <div className="space-y-6">
          <ProjectHeader />
          <PageHeader title="Forecast" />
          <Notice
            type="error"
            title="Error"
            message={projectError ?? "Project not found"}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-10">
        <ProjectHeader />
        <PageHeader title="Forecast" />

        {itemsError && (
          <Notice
            type="error"
            title="Error loading forecast"
            message={itemsError}
          />
        )}

        <div className="flex gap-8">
          <main className="min-w-0 flex-1">
            <InputsSectionCard
              id="forecast-items"
              icon={<Recycle className="size-5" />}
              title="Forecast Items"
              description="Add and edit forecast line items. Waste qty is calculated from quantity and excess %."
              accent="blue"
            >
              {itemsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-[280px] w-full rounded-lg" />
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 py-12 px-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    No forecast items yet. Add your first item to get started.
                  </p>
                  <Button type="button" onClick={() => handleItemsChange([{
                    id: `new-${Date.now()}`,
                    project_id: projectId,
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
                  }])}>
                    <PlusIcon className="size-4 mr-2" />
                    Add Forecast Item
                  </Button>
                </div>
              ) : (
                <>
                  {unallocatedCount > 0 && (
                    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3 text-sm">
                      <AlertTriangleIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
                      <span className="text-amber-900 dark:text-amber-100">
                        <strong>{unallocatedCount}</strong> item{unallocatedCount !== 1 ? "s" : ""} unallocated — not included in stream totals.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterStatus("unallocated")}
                      >
                        Show unallocated
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setAllocateAllOpen(true)}
                      >
                        Allocate all to Mixed C&D
                      </Button>
                    </div>
                  )}
                  {needsConversionCount > 0 && (
                    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40 px-4 py-3 text-sm">
                      <AlertTriangleIcon className="size-5 shrink-0 text-orange-600 dark:text-orange-500" />
                      <span className="text-orange-900 dark:text-orange-100">
                        <strong>{needsConversionCount}</strong> item{needsConversionCount !== 1 ? "s" : ""} need conversion — add kg per m or use a weight unit.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterStatus("needs_conversion")}
                      >
                        Fix conversions
                      </Button>
                    </div>
                  )}
                  {saveStatus === "saving" && (
                    <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">Saving…</p>
                  )}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-sm">Filter:</span>
                    {(["all", "unallocated", "needs_conversion", "included"] as const).map((status) => (
                      <Button
                        key={status}
                        type="button"
                        variant={filterStatus === status ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setFilterStatus(status)}
                      >
                        {status === "all" && "All"}
                        {status === "unallocated" && `Unallocated (${unallocatedCount})`}
                        {status === "needs_conversion" && `Needs conversion (${needsConversionCount})`}
                        {status === "included" && `Included (${includedCount})`}
                      </Button>
                    ))}
                  </div>
                  {filterStream && (
                    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 dark:border-border dark:bg-muted/50 px-4 py-3 text-sm text-slate-900 dark:text-foreground">
                      <span className="font-medium">Stream: {filterStream}</span>
                      {" — Showing items allocated to this stream. "}
                      <Link href={`/projects/${projectId}/forecast`} className="text-primary hover:underline font-medium">
                        Show all items
                      </Link>
                    </div>
                  )}
                  <ForecastTable
                    projectId={projectId}
                    items={items}
                    displayFilter={filterStatus}
                    onItemsChange={handleItemsChange}
                    saveStatus={saveStatus}
                    projectStreams={projectStreams}
                    onAllocateToStream={handleAllocateToStream}
                    wasteStreamTypes={wasteStreamTypes}
                    onRefetchWasteStreamTypes={fetchWasteStreamTypes}
                    isSuperAdmin={isSuperAdmin}
                    filterStream={filterStream}
                  />
                </>
              )}
            </InputsSectionCard>
          </main>
          <aside className="hidden lg:block w-72 shrink-0">
            {itemsLoading ? (
              <Skeleton className="h-[320px] w-full rounded-2xl" />
            ) : (
              <ForecastSummary items={items} className="sticky top-24" />
            )}
          </aside>
        </div>

        {/* Summary below table on small screens */}
        {!itemsLoading && items.length > 0 ? (
          <div className="lg:hidden">
            <ForecastSummary items={items} />
          </div>
        ) : null}

        <Dialog open={allocateAllOpen} onOpenChange={setAllocateAllOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Allocate all unallocated to Mixed C&D?</DialogTitle>
              <DialogDescription>
                This will set the waste stream to &quot;Mixed C&D&quot; for all {unallocatedCount} unallocated item{unallocatedCount !== 1 ? "s" : ""}.
                Stream totals will be recomputed. You can change individual allocations later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAllocateAllOpen(false)} disabled={allocateAllLoading}>
                Cancel
              </Button>
              <Button type="button" onClick={handleAllocateAllUnallocated} disabled={allocateAllLoading}>
                {allocateAllLoading ? "Allocating…" : "Allocate all"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
