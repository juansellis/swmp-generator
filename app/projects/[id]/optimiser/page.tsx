"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectHeader } from "@/components/project-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectContext } from "../project-context";
import { toast } from "sonner";
import { Zap, ChevronDown, Info, MapPin, CheckCircle2, AlertCircle } from "lucide-react";

type OptimiserResultItem = {
  stream_name: string;
  planned_tonnes: number;
  recommended_facility_id: string;
  recommended_facility_name: string;
  distance_km: number | null;
  duration_min: number | null;
  estimated_cost: number | null;
  estimated_carbon: number | null;
  alternatives: Array<{
    facility_id: string;
    facility_name: string;
    distance_km: number | null;
    duration_min: number | null;
  }>;
  reason: {
    primary: string;
    breakdown: string[];
    eligibility_count?: number;
    rank_by_distance?: number;
  };
  eligible_facilities: Array<{ facility_id: string; facility_name: string }>;
};

type Status = {
  project_geocoded?: boolean;
  project_has_address?: boolean;
  facilities_geocoded: number;
  facilities_total: number;
  geocoded_facility_ids?: string[];
  facility_ids_without_geocode?: string[];
  distances_cached: number;
  last_updated_at: string | null;
};

export default function ProjectOptimiserPage() {
  const params = useParams<{ id: string }>();
  const projectId = (params?.id as string) ?? null;
  const ctx = useProjectContext();

  const [status, setStatus] = React.useState<Status | null>(null);
  const [streams, setStreams] = React.useState<Array<{
    stream_name: string;
    total_tonnes: number;
    assigned_facility_id: string | null;
    assigned_facility_name: string | null;
    nearest: { facility_id: string; facility_name: string }[];
  }>>([]);
  const [results, setResults] = React.useState<OptimiserResultItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [runLoading, setRunLoading] = React.useState(false);
  const [runPhase, setRunPhase] = React.useState<"idle" | "computing" | "running">("idle");
  const [applyLoading, setApplyLoading] = React.useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = React.useState(false);
  const [weightDistance, setWeightDistance] = React.useState(1);
  const [lastRunAt, setLastRunAt] = React.useState<number | null>(null);
  const [overrides, setOverrides] = React.useState<Map<string, string>>(new Map());
  const [geoAction, setGeoAction] = React.useState<"idle" | "geocode_project" | "geocode_facilities" | "recompute">("idle");
  const [geoProgress, setGeoProgress] = React.useState<string | null>(null);
  const [runConfirmOpen, setRunConfirmOpen] = React.useState(false);
  const [runConfirmPending, setRunConfirmPending] = React.useState<"geocode_and_run" | "run_fallback" | null>(null);

  const fetchStatus = React.useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/facility-optimiser`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to load");
      }
      const data = await res.json();
      setStatus({
        project_geocoded: data.project_geocoded ?? false,
        project_has_address: data.project_has_address ?? false,
        facilities_geocoded: data.facilities_geocoded ?? 0,
        facilities_total: data.facilities_total ?? 0,
        geocoded_facility_ids: data.geocoded_facility_ids ?? [],
        facility_ids_without_geocode: data.facility_ids_without_geocode ?? [],
        distances_cached: data.distances_cached ?? 0,
        last_updated_at: data.last_updated_at ?? null,
      });
      setStreams(data.streams ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load optimiser data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleGeocodeProject = async () => {
    if (!projectId) return;
    setGeoAction("geocode_project");
    setGeoProgress("Geocoding project…");
    try {
      const res = await fetch(`/api/projects/${projectId}/geocode`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Geocode failed");
      }
      toast.success("Project location geocoded");
      await fetchStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Geocode failed");
    } finally {
      setGeoAction("idle");
      setGeoProgress(null);
    }
  };

  const handleGeocodeMissingFacilities = async () => {
    if (!projectId || !status) return;
    const toGeocode = status.facility_ids_without_geocode ?? [];
    if (toGeocode.length === 0) {
      toast.success("All facilities already geocoded");
      return;
    }
    setGeoAction("geocode_facilities");
    let done = 0;
    for (let i = 0; i < toGeocode.length; i++) {
      setGeoProgress(`Geocoding facilities (${i + 1}/${toGeocode.length})…`);
      const r = await fetch(`/api/facilities/${toGeocode[i]}/geocode`, { method: "POST", credentials: "include" });
      if (r.ok) done += 1;
    }
    setGeoProgress(null);
    setGeoAction("idle");
    if (done > 0) {
      toast.success(`Geocoded ${done} facilit${done === 1 ? "y" : "ies"}`);
      await fetchStatus();
    } else {
      toast.error("Facility geocoding is available in Admin (requires admin access).");
    }
  };

  const handleRecomputeDistances = async () => {
    if (!projectId) return;
    setGeoAction("recompute");
    setGeoProgress("Computing distances…");
    try {
      const res = await fetch(`/api/projects/${projectId}/distances/recompute`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Recompute failed");
      }
      const data = await res.json().catch(() => ({}));
      const updated = (data as { updated?: number }).updated ?? 0;
      toast.success(updated > 0 ? `Computed distances for ${updated} facilities` : "Distances up to date");
      await fetchStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recompute failed");
    } finally {
      setGeoAction("idle");
      setGeoProgress(null);
    }
  };

  const needsGeocodeForDistance =
    !loading &&
    (status?.project_geocoded === false || (status?.facilities_geocoded ?? 0) < (status?.facilities_total ?? 0) || (status?.distances_cached ?? 0) === 0);

  const handleRunClick = () => {
    if (needsGeocodeForDistance && (status?.facilities_total ?? 0) > 0) {
      setRunConfirmOpen(true);
      return;
    }
    void handleRunOptimiser();
  };

  const handleRunConfirm = async (choice: "geocode_and_run" | "run_fallback") => {
    setRunConfirmOpen(false);
    if (!projectId) return;
    if (choice === "geocode_and_run") {
      if (status?.project_geocoded === false && status?.project_has_address) {
        setGeoAction("geocode_project");
        setGeoProgress("Geocoding project…");
        try {
          await fetch(`/api/projects/${projectId}/geocode`, { method: "POST", credentials: "include" });
          await fetchStatus();
        } finally {
          setGeoAction("idle");
          setGeoProgress(null);
        }
      }
      await handleRunOptimiser();
    } else {
      await handleRunOptimiser({ skipRecompute: true });
    }
  };

  const handleRunOptimiser = async (opts?: { skipRecompute?: boolean }) => {
    if (!projectId) return;
    setRunLoading(true);
    try {
      const needsCompute =
        !opts?.skipRecompute &&
        (status?.distances_cached ?? 0) === 0 &&
        (status?.facilities_total ?? 0) > 0;
      if (needsCompute) {
        setRunPhase("computing");
        const recomputeRes = await fetch(`/api/projects/${projectId}/distances/recompute`, {
          method: "POST",
          credentials: "include",
        });
        if (!recomputeRes.ok) {
          const err = await recomputeRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? "Could not compute distances");
        }
        const recomputeData = await recomputeRes.json().catch(() => ({}));
        const updated = (recomputeData as { updated?: number }).updated ?? 0;
        if (updated > 0) {
          toast.success(`Computed distances for ${updated} facilities`);
        }
        await fetchStatus();
        setRunPhase("running");
      } else {
        setRunPhase("running");
      }
      const res = await fetch(`/api/projects/${projectId}/facility-optimiser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          weights: { distance: weightDistance, cost: 0, carbon: 0 },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Optimiser run failed");
      }
      const data = await res.json();
      setResults(data.results ?? []);
      setLastRunAt(Date.now());
      setOverrides(new Map());
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              project_geocoded: data.project_geocoded ?? prev.project_geocoded,
              geocoded_facility_ids: data.geocoded_facility_ids ?? prev.geocoded_facility_ids,
              facilities_geocoded: data.facilities_geocoded ?? prev.facilities_geocoded,
              distances_cached: data.distances_cached ?? prev.distances_cached,
              last_updated_at: data.last_updated_at ?? prev.last_updated_at,
            }
          : prev
      );
      toast.success("Optimiser run complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunLoading(false);
      setRunPhase("idle");
    }
  };

  const displayResults = results ?? [];
  const effectiveSelection = (row: OptimiserResultItem): string => {
    const over = overrides.get(row.stream_name);
    if (over) return over;
    return row.recommended_facility_id || "";
  };

  const handleApply = async () => {
    if (!projectId || displayResults.length === 0) return;
    const assignments = displayResults
      .map((r) => {
        const fid = effectiveSelection(r);
        return fid ? { stream_name: r.stream_name, facility_id: fid } : null;
      })
      .filter((a): a is { stream_name: string; facility_id: string } => a != null);
    if (assignments.length === 0) {
      toast.error("No facility selections to apply");
      return;
    }
    setApplyLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/facility-optimiser/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Apply failed");
      }
      setApplyDialogOpen(false);
      toast.success("Recommendations applied");
      fetchStatus();
      setResults(null);
      setLastRunAt(null);
      setOverrides(new Map());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplyLoading(false);
    }
  };

  const noStreams = streams.length === 0 && !loading;
  const noFacilities = (status?.facilities_total ?? 0) === 0 && !loading;
  const distancesNotYetComputed = (status?.distances_cached ?? 0) === 0 && (status?.facilities_total ?? 0) > 0 && !loading;
  const hasResults = displayResults.length > 0;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <ProjectHeader />
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="size-5 text-amber-500" />
                  Facility Optimiser
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Recommend best facilities per stream based on distance, cost, and carbon.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 sm:mt-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Distance weight</span>
                  <Select
                    value={String(weightDistance)}
                    onValueChange={(v) => setWeightDistance(Number(v))}
                  >
                    <SelectTrigger className="w-[100px] h-8 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (default)</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="0.5">0.5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleRunClick}
                  disabled={runLoading || loading || noStreams || noFacilities}
                  className="gap-2"
                >
                  {runLoading
                    ? runPhase === "computing"
                      ? "Computing distances…"
                      : "Ranking facilities…"
                    : "Run optimiser"}
                </Button>
                {lastRunAt != null && (
                  <span className="text-xs text-muted-foreground">
                    Last run: {new Date(lastRunAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {!loading && !noStreams && !noFacilities ? (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                Location status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {geoProgress ? (
                <p className="text-sm text-muted-foreground">{geoProgress}</p>
              ) : null}
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  {status?.project_geocoded ? (
                    <CheckCircle2 className="size-4 text-green-600 dark:text-green-500" aria-hidden />
                  ) : (
                    <AlertCircle className="size-4 text-amber-600 dark:text-amber-500" aria-hidden />
                  )}
                  Project location: {status?.project_geocoded ? "geocoded" : "missing geocode"}
                </span>
                <span className="text-muted-foreground">
                  Facilities: {status?.facilities_geocoded ?? 0}/{status?.facilities_total ?? 0} geocoded
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={geoAction !== "idle" || status?.project_geocoded || !status?.project_has_address}
                  onClick={handleGeocodeProject}
                >
                  Geocode project
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    geoAction !== "idle" ||
                    (status?.facility_ids_without_geocode?.length ?? 0) === 0
                  }
                  onClick={handleGeocodeMissingFacilities}
                >
                  Geocode missing facilities
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={geoAction !== "idle" || (status?.facilities_total ?? 0) === 0}
                  onClick={handleRecomputeDistances}
                >
                  Recompute distances
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <AlertDialog open={runConfirmOpen} onOpenChange={setRunConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogTitle>Geocode to rank by distance?</AlertDialogTitle>
            <AlertDialogDescription>
              We need project and facility locations to compute distances and rank by distance. You can geocode now and run, or run anyway to get a fallback recommendation (e.g. alphabetical).
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleRunConfirm("run_fallback")}>
                Run anyway (fallback)
              </AlertDialogAction>
              <AlertDialogAction onClick={() => handleRunConfirm("geocode_and_run")}>
                Geocode and run
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {loading ? (
          <Card className="border-border/50">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : noStreams ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No waste streams with planned tonnes.</p>
              <p className="text-sm text-muted-foreground mt-1">Add streams and quantities in Inputs, then run the optimiser.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/projects/${projectId}/inputs`}>Go to Inputs</Link>
              </Button>
            </CardContent>
          </Card>
        ) : noFacilities ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No facilities available.</p>
              <p className="text-sm text-muted-foreground mt-1">Configure facilities in Admin to get recommendations.</p>
            </CardContent>
          </Card>
        ) : !hasResults ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center space-y-3">
              <p className="text-muted-foreground">Click &quot;Run optimiser&quot; to see recommended facilities per stream.</p>
              {distancesNotYetComputed && (
                <p className="text-sm text-muted-foreground">
                  Distances are not computed yet. Run will compute them first, then rank facilities by distance.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="font-medium">Waste stream</TableHead>
                      <TableHead className="text-right font-medium">Planned (t)</TableHead>
                      <TableHead className="font-medium">Recommended facility</TableHead>
                      <TableHead className="text-right font-medium">Distance</TableHead>
                      <TableHead className="text-right font-medium">Cost</TableHead>
                      <TableHead className="text-right font-medium">Carbon</TableHead>
                      <TableHead className="font-medium">Reason</TableHead>
                      <TableHead className="w-[100px] font-medium">Alternatives</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayResults.map((row) => {
                      const selectedId = effectiveSelection(row);
                      const choice = row.eligible_facilities.find((e) => e.facility_id === selectedId)
                        ?? (row.recommended_facility_id
                          ? { facility_id: row.recommended_facility_id, facility_name: row.recommended_facility_name }
                          : null);
                      const selectValue = selectedId || row.recommended_facility_id || "";
                      return (
                        <TableRow key={row.stream_name} className="border-border/50">
                          <TableCell className="font-medium">{row.stream_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.planned_tonnes.toFixed(1)}</TableCell>
                          <TableCell>
                            <Select
                              value={selectValue || "__none__"}
                              onValueChange={(v) => {
                                if (v === "__none__" || !v) {
                                  const next = new Map(overrides);
                                  next.delete(row.stream_name);
                                  setOverrides(next);
                                } else {
                                  setOverrides((prev) => new Map(prev).set(row.stream_name, v));
                                }
                              }}
                            >
                              <SelectTrigger className="w-[200px] border-border/50 h-9">
                                <SelectValue placeholder="Select facility">
                                  {choice ? `${choice.facility_name}${selectedId === row.recommended_facility_id ? " (recommended)" : ""}` : "—"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {!selectValue ? (
                                  <SelectItem value="__none__">— No facility —</SelectItem>
                                ) : null}
                                {row.recommended_facility_id ? (
                                  <SelectItem value={row.recommended_facility_id}>
                                    {row.recommended_facility_name} (recommended)
                                  </SelectItem>
                                ) : null}
                                {row.eligible_facilities
                                  .filter((e) => e.facility_id !== row.recommended_facility_id)
                                  .map((e) => (
                                    <SelectItem key={e.facility_id} value={e.facility_id}>
                                      {e.facility_name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground align-top">
                            {row.distance_km != null ? (
                              <span
                                title={row.duration_min != null ? `~${Math.round(row.duration_min)} min drive` : undefined}
                              >
                                {row.distance_km.toFixed(1)} km
                              </span>
                            ) : (selectedId || row.recommended_facility_id) ? (() => {
                              const projectOk = status?.project_geocoded === true;
                              const facilityOk = selectedId
                                ? (status?.geocoded_facility_ids ?? []).includes(selectedId)
                                : (status?.geocoded_facility_ids ?? []).includes(row.recommended_facility_id);
                              const facilityName = choice?.facility_name ?? row.recommended_facility_name ?? "Facility";
                              if (!projectOk && !facilityOk) {
                                return (
                                  <span className="block text-amber-600 dark:text-amber-500">
                                    Missing geocode
                                    <span
                                      title="Project and facility need geocoding. Set project location and geocode facilities to compute distances."
                                      className="inline-block ml-0.5"
                                    >
                                      <Info className="size-3.5 inline align-middle cursor-help" aria-hidden />
                                    </span>
                                    <div className="flex flex-col gap-0.5 mt-1 text-xs">
                                      <button
                                        type="button"
                                        onClick={handleGeocodeProject}
                                        disabled={geoAction !== "idle" || !status?.project_has_address}
                                        className="text-left text-primary hover:underline disabled:opacity-50"
                                      >
                                        Geocode project
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleGeocodeMissingFacilities}
                                        disabled={geoAction !== "idle"}
                                        className="text-left text-primary hover:underline disabled:opacity-50"
                                      >
                                        Geocode facilities
                                      </button>
                                    </div>
                                  </span>
                                );
                              }
                              if (!projectOk) {
                                return (
                                  <span className="block text-amber-600 dark:text-amber-500">
                                    Project not geocoded
                                    <span title="Set project location to compute distances." className="inline-block ml-0.5">
                                      <Info className="size-3.5 inline align-middle cursor-help" aria-hidden />
                                    </span>
                                    <button
                                      type="button"
                                      onClick={handleGeocodeProject}
                                      disabled={geoAction !== "idle" || !status?.project_has_address}
                                      className="block mt-1 text-xs text-primary hover:underline disabled:opacity-50"
                                    >
                                      Geocode project
                                    </button>
                                  </span>
                                );
                              }
                              if (!facilityOk) {
                                return (
                                  <span className="block text-amber-600 dark:text-amber-500">
                                    Facility not geocoded
                                    <span title={`${facilityName} needs geocoding. Use Location status or Admin.`} className="inline-block ml-0.5">
                                      <Info className="size-3.5 inline align-middle cursor-help" aria-hidden />
                                    </span>
                                    <button
                                      type="button"
                                      onClick={handleGeocodeMissingFacilities}
                                      disabled={geoAction !== "idle"}
                                      className="block mt-1 text-xs text-primary hover:underline disabled:opacity-50"
                                    >
                                      Geocode facilities
                                    </button>
                                  </span>
                                );
                              }
                              return (
                                <span className="block text-amber-600 dark:text-amber-500">
                                  <span title="Distances not computed yet. Recompute to refresh.">Not computed</span>
                                  <button
                                    type="button"
                                    onClick={handleRecomputeDistances}
                                    disabled={geoAction !== "idle"}
                                    className="block mt-1 text-xs text-primary hover:underline disabled:opacity-50"
                                  >
                                    Recompute distances
                                  </button>
                                </span>
                              );
                            })() : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.estimated_cost != null ? `$${row.estimated_cost.toFixed(0)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.estimated_carbon != null ? `${row.estimated_carbon.toFixed(2)} tCO2e` : "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              title={row.reason.breakdown?.length ? row.reason.breakdown.join("\n") : row.reason.primary}
                              className="inline-flex items-center gap-1 text-sm text-muted-foreground cursor-help"
                            >
                              {row.reason.primary}
                              <Info className="size-3.5 shrink-0" aria-hidden />
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.alternatives.length > 0 ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                                    View top 3
                                    <ChevronDown className="size-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {row.alternatives.map((alt, i) => (
                                    <DropdownMenuItem key={alt.facility_id} disabled>
                                      <span className="font-medium">{alt.facility_name}</span>
                                      {alt.distance_km != null && (
                                        <span className="text-muted-foreground ml-1">
                                          {alt.distance_km} km
                                        </span>
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={() => setApplyDialogOpen(true)}
                disabled={applyLoading}
                className="gap-2"
              >
                <MapPin className="size-4" />
                {applyLoading ? "Applying…" : "Apply recommendations"}
              </Button>
              <p className="text-sm text-muted-foreground">
                This will update stream → facility assignments in your project plan.
              </p>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply facility recommendations</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the selected facility for each waste stream in your project plan. You can change
              individual selections in the table before applying. Existing custom destinations will not be
              changed. This uses the same save path as the Report page and does not affect autosave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApply} disabled={applyLoading}>
              {applyLoading ? "Applying…" : "Apply"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
