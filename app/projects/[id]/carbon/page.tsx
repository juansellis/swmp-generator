"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useProjectContext } from "../project-context";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProjectHeader } from "@/components/project-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Notice } from "@/components/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown } from "lucide-react";

type VehicleFactor = {
  id: string;
  name: string;
  weight_range: string | null;
  fuel_type: string;
  avg_consumption_per_hr: number;
  consumption_unit: string;
  conversion_factor_kgco2e_per_unit: number;
};

type ResourceFactor = {
  id: string;
  category: string;
  name: string;
  unit: string;
  conversion_factor_kgco2e_per_unit: number;
};

type VehicleEntry = {
  id: string;
  project_id: string;
  factor_id: string;
  time_active_hours: number;
  notes: string | null;
  created_at: string;
  factor: VehicleFactor;
};

type ResourceEntry = {
  id: string;
  project_id: string;
  factor_id: string;
  quantity_used: number;
  notes: string | null;
  created_at: string;
  factor: ResourceFactor;
};

const DEBOUNCE_MS = 500;

function round2(n: number): string {
  if (!Number.isFinite(n)) return "0.00";
  return (Math.round(n * 100) / 100).toFixed(2);
}

export default function ProjectCarbonPage() {
  const params = useParams<{ id: string }>();
  const projectId = (params?.id as string) ?? null;
  const ctx = useProjectContext();
  const project = ctx?.project ?? null;
  const projectLoading = ctx?.projectLoading ?? true;
  const projectError = ctx?.projectError ?? null;

  const [vehicleFactors, setVehicleFactors] = React.useState<VehicleFactor[]>([]);
  const [resourceFactors, setResourceFactors] = React.useState<ResourceFactor[]>([]);
  const [vehicleEntries, setVehicleEntries] = React.useState<VehicleEntry[]>([]);
  const [resourceEntries, setResourceEntries] = React.useState<ResourceEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = React.useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [vFactors, rFactors, vEntries, rEntries] = await Promise.all([
        supabase
          .from("carbon_vehicle_factors")
          .select("id, name, weight_range, fuel_type, avg_consumption_per_hr, consumption_unit, conversion_factor_kgco2e_per_unit")
          .eq("is_active", true)
          .order("sort_order")
          .order("name"),
        supabase
          .from("carbon_resource_factors")
          .select("id, category, name, unit, conversion_factor_kgco2e_per_unit")
          .eq("is_active", true)
          .order("sort_order")
          .order("name"),
        supabase
          .from("project_carbon_vehicle_entries")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at"),
        supabase
          .from("project_carbon_resource_entries")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at"),
      ]);

      if (vFactors.error && !vFactors.error.message.includes("Could not find the table")) {
        setError(vFactors.error.message);
      }
      if (rFactors.error && !rFactors.error.message.includes("Could not find the table")) {
        setError(rFactors.error.message ?? error);
      }

      const vFactorList = (vFactors.data ?? []) as VehicleFactor[];
      const rFactorList = (rFactors.data ?? []) as ResourceFactor[];
      const factorById = new Map(vFactorList.map((f) => [f.id, f]));
      const rFactorById = new Map(rFactorList.map((f) => [f.id, f]));

      const vEnt = ((vEntries.data ?? []) as (VehicleEntry & { factor?: VehicleFactor })[]).map((e) => {
        const factor = factorById.get(e.factor_id);
        return { ...e, factor: factor ?? (e.factor as VehicleFactor) };
      }).filter((e) => e.factor);
      const rEnt = ((rEntries.data ?? []) as (ResourceEntry & { factor?: ResourceFactor })[]).map((e) => {
        const factor = rFactorById.get(e.factor_id);
        return { ...e, factor: factor ?? (e.factor as ResourceFactor) };
      }).filter((e) => e.factor);

      setVehicleFactors(vFactorList);
      setResourceFactors(rFactorList);
      setVehicleEntries(vEnt as VehicleEntry[]);
      setResourceEntries(rEnt as ResourceEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const { machinerySubtotal, resourceSubtotal, totalEmissions } = React.useMemo(() => {
    let machinery = 0;
    for (const e of vehicleEntries) {
      const t = Number(e.time_active_hours) || 0;
      const c = e.factor?.avg_consumption_per_hr ?? 0;
      const k = e.factor?.conversion_factor_kgco2e_per_unit ?? 0;
      machinery += t * c * k;
    }
    let resource = 0;
    for (const e of resourceEntries) {
      const q = Number(e.quantity_used) || 0;
      const k = e.factor?.conversion_factor_kgco2e_per_unit ?? 0;
      resource += q * k;
    }
    return {
      machinerySubtotal: machinery,
      resourceSubtotal: resource,
      totalEmissions: machinery + resource,
    };
  }, [vehicleEntries, resourceEntries]);

  const addVehicleEntry = React.useCallback(
    async (factorId: string) => {
      if (!projectId) return;
      const { error: e } = await supabase.from("project_carbon_vehicle_entries").insert({
        project_id: projectId,
        factor_id: factorId,
        time_active_hours: 0,
      });
      if (e) {
        toast.error(e.message);
        return;
      }
      toast.success("Machinery added");
      fetchAll();
    },
    [projectId, fetchAll]
  );

  const addResourceEntry = React.useCallback(
    async (factorId: string) => {
      if (!projectId) return;
      const { error: e } = await supabase.from("project_carbon_resource_entries").insert({
        project_id: projectId,
        factor_id: factorId,
        quantity_used: 0,
      });
      if (e) {
        toast.error(e.message);
        return;
      }
      toast.success("Item added");
      fetchAll();
    },
    [projectId, fetchAll]
  );

  const updateVehicleEntry = React.useCallback(
    async (entryId: string, patch: { time_active_hours?: number; notes?: string | null }) => {
      const { error: e } = await supabase
        .from("project_carbon_vehicle_entries")
        .update(patch)
        .eq("id", entryId);
      if (e) {
        toast.error(e.message);
        return;
      }
      setVehicleEntries((prev) =>
        prev.map((x) =>
          x.id === entryId ? { ...x, ...patch } : x
        )
      );
    },
    []
  );

  const updateResourceEntry = React.useCallback(
    async (entryId: string, patch: { quantity_used?: number; notes?: string | null }) => {
      const { error: e } = await supabase
        .from("project_carbon_resource_entries")
        .update(patch)
        .eq("id", entryId);
      if (e) {
        toast.error(e.message);
        return;
      }
      setResourceEntries((prev) =>
        prev.map((x) =>
          x.id === entryId ? { ...x, ...patch } : x
        )
      );
    },
    []
  );

  const removeVehicleEntry = React.useCallback(
    async (entryId: string) => {
      const { error: e } = await supabase.from("project_carbon_vehicle_entries").delete().eq("id", entryId);
      if (e) {
        toast.error(e.message);
        return;
      }
      setVehicleEntries((prev) => prev.filter((x) => x.id !== entryId));
      toast.success("Removed");
    },
    []
  );

  const removeResourceEntry = React.useCallback(
    async (entryId: string) => {
      const { error: e } = await supabase.from("project_carbon_resource_entries").delete().eq("id", entryId);
      if (e) {
        toast.error(e.message);
        return;
      }
      setResourceEntries((prev) => prev.filter((x) => x.id !== entryId));
      toast.success("Removed");
    },
    []
  );

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
          <PageHeader title="Carbon Forecast" />
          <Notice type="error" title="Error" message={projectError ?? "Project not found"} className="max-w-4xl mx-auto px-4" />
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <ProjectHeader />
          <PageHeader title="Carbon Forecast" />
          <div className="max-w-4xl mx-auto px-4 space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <ProjectHeader />
        <div className="max-w-4xl mx-auto px-4">
          <PageHeader
            title="Carbon Forecast"
            subtitle={
              saveStatus === "saved" ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-sm">Saved</span>
              ) : saveStatus === "saving" ? (
                <span className="text-muted-foreground text-sm">Saving…</span>
              ) : null
            }
          />
        </div>

        {error && (
          <div className="max-w-4xl mx-auto px-4">
            <Notice type="error" title="Error" message={error} />
          </div>
        )}

        <div className="max-w-4xl mx-auto px-4 space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total operational emissions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{round2(totalEmissions)} kg CO₂e</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Machinery & vehicles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{round2(machinerySubtotal)} kg CO₂e</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Water, energy & fuel</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{round2(resourceSubtotal)} kg CO₂e</p>
              </CardContent>
            </Card>
          </div>

          <MachinerySection
            vehicleFactors={vehicleFactors}
            vehicleEntries={vehicleEntries}
            addedFactorIds={new Set(vehicleEntries.map((e) => e.factor_id))}
            onAdd={addVehicleEntry}
            onUpdate={updateVehicleEntry}
            onRemove={removeVehicleEntry}
            saveStatusRef={{ setSaveStatus }}
            saveTimeoutRef={saveTimeoutRef}
            debounceMs={DEBOUNCE_MS}
          />

          <ResourceSection
            resourceFactors={resourceFactors}
            resourceEntries={resourceEntries}
            addedFactorIds={new Set(resourceEntries.map((e) => e.factor_id))}
            onAdd={addResourceEntry}
            onUpdate={updateResourceEntry}
            onRemove={removeResourceEntry}
            saveStatusRef={{ setSaveStatus }}
            saveTimeoutRef={saveTimeoutRef}
            debounceMs={DEBOUNCE_MS}
          />
        </div>
      </div>
    </AppShell>
  );
}

function MachinerySection({
  vehicleFactors,
  vehicleEntries,
  addedFactorIds,
  onAdd,
  onUpdate,
  onRemove,
  saveStatusRef,
  saveTimeoutRef,
  debounceMs,
}: {
  vehicleFactors: VehicleFactor[];
  vehicleEntries: VehicleEntry[];
  addedFactorIds: Set<string>;
  onAdd: (factorId: string) => void;
  onUpdate: (entryId: string, patch: { time_active_hours?: number; notes?: string | null }) => void;
  onRemove: (entryId: string) => void;
  saveStatusRef: { setSaveStatus: (s: "idle" | "saving" | "saved") => void };
  saveTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  debounceMs: number;
}) {
  const [localEntries, setLocalEntries] = React.useState<VehicleEntry[]>(vehicleEntries);
  const [addOpen, setAddOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [removeConfirm, setRemoveConfirm] = React.useState<VehicleEntry | null>(null);

  React.useEffect(() => {
    setLocalEntries(vehicleEntries);
  }, [vehicleEntries]);

  const availableFactors = React.useMemo(
    () => vehicleFactors.filter((f) => !addedFactorIds.has(f.id)),
    [vehicleFactors, addedFactorIds]
  );
  const filteredFactors = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableFactors;
    return availableFactors.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.weight_range ?? "").toLowerCase().includes(q) ||
        (f.fuel_type ?? "").toLowerCase().includes(q)
    );
  }, [availableFactors, search]);

  const debouncedSave = React.useCallback(
    (entryId: string, patch: { time_active_hours?: number; notes?: string | null }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveStatusRef.setSaveStatus("saving");
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        onUpdate(entryId, patch);
        saveStatusRef.setSaveStatus("saved");
        setTimeout(() => saveStatusRef.setSaveStatus("idle"), 2000);
      }, debounceMs);
    },
    [onUpdate, saveStatusRef, saveTimeoutRef, debounceMs]
  );

  const handleTimeChange = (entry: VehicleEntry, value: string) => {
    const num = parseFloat(value);
    const v = Number.isNaN(num) || num < 0 ? 0 : num;
    setLocalEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, time_active_hours: v } : e)));
    debouncedSave(entry.id, { time_active_hours: v });
  };

  const handleNotesChange = (entry: VehicleEntry, value: string) => {
    const notes = value.trim() || null;
    setLocalEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, notes } : e)));
    debouncedSave(entry.id, { notes });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Machinery & vehicles</CardTitle>
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={availableFactors.length === 0}>
                <Plus className="size-4 mr-2" />
                Add machinery
                <ChevronDown className="size-4 ml-1 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search machinery…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="max-h-64 overflow-auto">
                {filteredFactors.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {availableFactors.length === 0 ? "All machinery added." : "No matches."}
                  </p>
                ) : (
                  filteredFactors.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-none"
                      onClick={() => {
                        onAdd(f.id);
                        setAddOpen(false);
                        setSearch("");
                      }}
                    >
                      {f.name}
                      {f.weight_range ? ` (${f.weight_range})` : ""} — {f.fuel_type}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Item</TableHead>
                <TableHead className="w-[90px]">Time active (hrs)</TableHead>
                <TableHead className="w-[80px]">Consumption/hr</TableHead>
                <TableHead className="w-[60px]">Unit</TableHead>
                <TableHead className="w-[80px]">kgCO₂e/unit</TableHead>
                <TableHead className="w-[90px]">Emissions</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-center py-8">
                    No machinery added. Click &quot;Add machinery&quot; to add from the library.
                  </TableCell>
                </TableRow>
              ) : (
                localEntries.map((entry) => {
                  const f = entry.factor;
                  const emissions = (Number(entry.time_active_hours) || 0) * (f?.avg_consumption_per_hr ?? 0) * (f?.conversion_factor_kgco2e_per_unit ?? 0);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <span className="font-medium">{f?.name ?? "—"}</span>
                        {f?.weight_range && (
                          <span className="text-muted-foreground ml-1">({f.weight_range})</span>
                        )}
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {f?.fuel_type ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          className="h-8 w-20 tabular-nums"
                          value={entry.time_active_hours}
                          onChange={(e) => handleTimeChange(entry, e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{f?.avg_consumption_per_hr ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{f?.consumption_unit ?? "—"}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{f?.conversion_factor_kgco2e_per_unit ?? "—"}</TableCell>
                      <TableCell className="tabular-nums font-medium">{round2(emissions)}</TableCell>
                      <TableCell>
                        <Input
                          placeholder="Notes"
                          className="h-8 text-sm"
                          value={entry.notes ?? ""}
                          onChange={(e) => handleNotesChange(entry, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setRemoveConfirm(entry)}
                          aria-label="Remove"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove machinery?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{removeConfirm?.factor?.name}&quot; from the list. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeConfirm) {
                  onRemove(removeConfirm.id);
                  setRemoveConfirm(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ResourceSection({
  resourceFactors,
  resourceEntries,
  addedFactorIds,
  onAdd,
  onUpdate,
  onRemove,
  saveStatusRef,
  saveTimeoutRef,
  debounceMs,
}: {
  resourceFactors: ResourceFactor[];
  resourceEntries: ResourceEntry[];
  addedFactorIds: Set<string>;
  onAdd: (factorId: string) => void;
  onUpdate: (entryId: string, patch: { quantity_used?: number; notes?: string | null }) => void;
  onRemove: (entryId: string) => void;
  saveStatusRef: { setSaveStatus: (s: "idle" | "saving" | "saved") => void };
  saveTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  debounceMs: number;
}) {
  const [localEntries, setLocalEntries] = React.useState<ResourceEntry[]>(resourceEntries);
  const [addOpen, setAddOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [removeConfirm, setRemoveConfirm] = React.useState<ResourceEntry | null>(null);

  React.useEffect(() => {
    setLocalEntries(resourceEntries);
  }, [resourceEntries]);

  const availableFactors = React.useMemo(
    () => resourceFactors.filter((f) => !addedFactorIds.has(f.id)),
    [resourceFactors, addedFactorIds]
  );
  const filteredFactors = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableFactors;
    return availableFactors.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.category ?? "").toLowerCase().includes(q)
    );
  }, [availableFactors, search]);

  const debouncedSave = React.useCallback(
    (entryId: string, patch: { quantity_used?: number; notes?: string | null }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveStatusRef.setSaveStatus("saving");
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        onUpdate(entryId, patch);
        saveStatusRef.setSaveStatus("saved");
        setTimeout(() => saveStatusRef.setSaveStatus("idle"), 2000);
      }, debounceMs);
    },
    [onUpdate, saveStatusRef, saveTimeoutRef, debounceMs]
  );

  const handleQuantityChange = (entry: ResourceEntry, value: string) => {
    const num = parseFloat(value);
    const v = Number.isNaN(num) || num < 0 ? 0 : num;
    setLocalEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, quantity_used: v } : e)));
    debouncedSave(entry.id, { quantity_used: v });
  };

  const handleNotesChange = (entry: ResourceEntry, value: string) => {
    const notes = value.trim() || null;
    setLocalEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, notes } : e)));
    debouncedSave(entry.id, { notes });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Water, energy & fuel</CardTitle>
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={availableFactors.length === 0}>
                <Plus className="size-4 mr-2" />
                Add item
                <ChevronDown className="size-4 ml-1 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search items…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="max-h-64 overflow-auto">
                {filteredFactors.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {availableFactors.length === 0 ? "All items added." : "No matches."}
                  </p>
                ) : (
                  filteredFactors.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-none"
                      onClick={() => {
                        onAdd(f.id);
                        setAddOpen(false);
                        setSearch("");
                      }}
                    >
                      {f.name} <Badge variant="outline" className="ml-1 text-xs">{f.category}</Badge>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Item</TableHead>
                <TableHead className="w-[100px]">Quantity used</TableHead>
                <TableHead className="w-[60px]">Unit</TableHead>
                <TableHead className="w-[80px]">kgCO₂e/unit</TableHead>
                <TableHead className="w-[90px]">Emissions</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                    No items added. Click &quot;Add item&quot; to add from the library.
                  </TableCell>
                </TableRow>
              ) : (
                localEntries.map((entry) => {
                  const f = entry.factor;
                  const emissions = (Number(entry.quantity_used) || 0) * (f?.conversion_factor_kgco2e_per_unit ?? 0);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <span className="font-medium">{f?.name ?? "—"}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {f?.category ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          className="h-8 w-24 tabular-nums"
                          value={entry.quantity_used}
                          onChange={(e) => handleQuantityChange(entry, e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f?.unit ?? "—"}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{f?.conversion_factor_kgco2e_per_unit ?? "—"}</TableCell>
                      <TableCell className="tabular-nums font-medium">{round2(emissions)}</TableCell>
                      <TableCell>
                        <Input
                          placeholder="Notes"
                          className="h-8 text-sm"
                          value={entry.notes ?? ""}
                          onChange={(e) => handleNotesChange(entry, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setRemoveConfirm(entry)}
                          aria-label="Remove"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{removeConfirm?.factor?.name}&quot; from the list. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeConfirm) {
                  onRemove(removeConfirm.id);
                  setRemoveConfirm(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
