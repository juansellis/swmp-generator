"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectHeader } from "@/components/project-header";
import { PlanSectionHeader } from "@/components/plan-section-header";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectContext } from "../project-context";
import { toast } from "sonner";
import { Zap, ChevronDown, ChevronRight, Info, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type OptimiserResultItem = {
  stream_name: string;
  planned_tonnes: number;
  recommended_facility_id: string;
  recommended_facility_name: string;
  /** 0–1 composite score (higher = better) */
  score?: number;
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
  const [weightCost, setWeightCost] = React.useState(0);
  const [weightCarbon, setWeightCarbon] = React.useState(0);
  const [weightDiversion, setWeightDiversion] = React.useState(0);
  const [expandedExplainStream, setExpandedExplainStream] = React.useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = React.useState<number | null>(null);
  const [overrides, setOverrides] = React.useState<Map<string, string>>(new Map());
  const [geoAction, setGeoAction] = React.useState<"idle" | "geocode_project" | "geocode_facilities" | "recompute">("idle");
  const [geoProgress, setGeoProgress] = React.useState<string | null>(null);
  const [runConfirmOpen, setRunConfirmOpen] = React.useState(false);
  const [runConfirmPending, setRunConfirmPending] = React.useState<"geocode_and_run" | "run_fallback" | null>(null);
  const [debugDistances, setDebugDistances] = React.useState<{ loaded: number; total: number } | null>(null);

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
      // Refresh optimiser results so distance column uses new distances (no page refresh)
      if (results != null && results.length > 0) {
        const optRes = await fetch(`/api/projects/${projectId}/facility-optimiser`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            weights: {
              distance: weightDistance,
              cost: weightCost,
              carbon: weightCarbon,
              diversion: weightDiversion,
            },
          }),
        });
        if (optRes.ok) {
          const optData = await optRes.json();
          setResults(optData.results ?? []);
          setStatus((prev) =>
            prev
              ? {
                  ...prev,
                  distances_cached: optData.distances_cached ?? prev.distances_cached,
                  last_updated_at: optData.last_updated_at ?? prev.last_updated_at,
                }
              : prev
          );
          setDebugDistances(
            optData.debug_distances_loaded != null && optData.debug_distances_total != null
              ? { loaded: optData.debug_distances_loaded, total: optData.debug_distances_total }
              : null
          );
        }
      }
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
    const hadNoDistances =
      !opts?.skipRecompute &&
      (status?.distances_cached ?? 0) === 0 &&
      (status?.facilities_total ?? 0) > 0;
    if (hadNoDistances) setRunPhase("computing");
    else setRunPhase("running");
    try {
      // Single source of truth: POST ensures distances (fetch or compute + persist) then runs scoring
      const res = await fetch(`/api/projects/${projectId}/facility-optimiser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          weights: {
            distance: weightDistance,
            cost: weightCost,
            carbon: weightCarbon,
            diversion: weightDiversion,
          },
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
      setDebugDistances(
        data.debug_distances_loaded != null && data.debug_distances_total != null
          ? { loaded: data.debug_distances_loaded, total: data.debug_distances_total }
          : null
      );
      if (hadNoDistances && (data.distances_cached ?? 0) > 0) {
        toast.success(`Distances loaded. Optimiser run complete.`);
      } else {
        toast.success("Optimiser run complete");
      }
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

  const applyAssignments = async (assignments: { stream_name: string; facility_id: string }[]) => {
    if (!projectId || assignments.length === 0) return;
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
      setDebugDistances(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplyLoading(false);
    }
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
    await applyAssignments(assignments);
  };

  const handleAutoApply = async () => {
    if (!projectId || displayResults.length === 0) return;
    const assignments = displayResults
      .filter((r) => r.recommended_facility_id)
      .map((r) => ({ stream_name: r.stream_name, facility_id: r.recommended_facility_id! }));
    if (assignments.length === 0) {
      toast.error("No recommendations to apply");
      return;
    }
    await applyAssignments(assignments);
  };

  const noStreams = streams.length === 0 && !loading;
  const noFacilities = (status?.facilities_total ?? 0) === 0 && !loading;
  const distancesNotYetComputed = (status?.distances_cached ?? 0) === 0 && (status?.facilities_total ?? 0) > 0 && !loading;
  const hasResults = displayResults.length > 0;

  const optimiserStatus = hasResults
    ? "complete"
    : noStreams || noFacilities
      ? undefined
      : "needs_attention";

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5 min-w-0 overflow-x-hidden">
        <ProjectHeader />
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <PlanSectionHeader
            icon={<Zap className="size-5 text-amber-500" />}
            title="Facility Optimiser"
            description="Recommend best facilities per stream based on distance, cost, and carbon."
            status={optimiserStatus}
            sticky={false}
          />
          <CardContent className="px-4 py-3 md:py-2">
            {/* Desktop: [Sliders] [Run + last run]. Mobile: [Run] [Sliders grid] [Last run] */}
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
              {/* Run button: full width on mobile, shrink on desktop */}
              <div className="w-full md:w-auto md:order-2 md:flex md:items-center md:gap-3">
                <Button
                  onClick={handleRunClick}
                  disabled={runLoading || loading || noStreams || noFacilities}
                  className="w-full gap-2 md:w-auto"
                >
                  {runLoading
                    ? runPhase === "computing"
                      ? "Computing distances…"
                      : "Ranking facilities…"
                    : "Run optimiser"}
                </Button>
                {lastRunAt != null && (
                  <span className="mt-2 block text-xs text-muted-foreground md:mt-0 md:inline">
                    Last run: {new Date(lastRunAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {/* Sliders: 2-col grid on small, single column when very narrow; on desktop inline */}
              <div className="grid w-full grid-cols-1 min-[360px]:grid-cols-2 gap-3 md:order-1 md:flex md:flex-wrap md:items-center md:gap-4 md:w-auto">
                <div className="flex items-center gap-2 w-full max-w-[140px] min-w-0">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Distance</Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={weightDistance}
                    onChange={(e) => setWeightDistance(Number(e.target.value))}
                    className="h-2 w-full max-w-20 min-w-0 shrink rounded-full accent-primary"
                  />
                  <span className="text-xs tabular-nums w-6 shrink-0">{weightDistance.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2 w-full max-w-[140px] min-w-0">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Cost</Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={weightCost}
                    onChange={(e) => setWeightCost(Number(e.target.value))}
                    className="h-2 w-full max-w-20 min-w-0 shrink rounded-full accent-primary"
                  />
                  <span className="text-xs tabular-nums w-6 shrink-0">{weightCost.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2 w-full max-w-[140px] min-w-0">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Carbon</Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={weightCarbon}
                    onChange={(e) => setWeightCarbon(Number(e.target.value))}
                    className="h-2 w-full max-w-20 min-w-0 shrink rounded-full accent-primary"
                  />
                  <span className="text-xs tabular-nums w-6 shrink-0">{weightCarbon.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2 w-full max-w-[140px] min-w-0">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Diversion</Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={weightDiversion}
                    onChange={(e) => setWeightDiversion(Number(e.target.value))}
                    className="h-2 w-full max-w-20 min-w-0 shrink rounded-full accent-primary"
                  />
                  <span className="text-xs tabular-nums w-6 shrink-0">{weightDiversion.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {!loading && !noStreams && !noFacilities ? (
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <PlanSectionHeader
              icon={<MapPin className="size-5" />}
              title="Location status"
              description="Project and facility geocoding for distance-based ranking."
              status={
                status?.project_geocoded && (status?.facilities_geocoded ?? 0) >= (status?.facilities_total ?? 0)
                  ? "complete"
                  : "needs_attention"
              }
              sticky={false}
            />
            <CardContent className="px-6 pb-6 space-y-3 pt-3">
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
            <CardContent className="p-8">
              <div className="flex flex-col gap-6 max-w-md mx-auto">
                <p className="text-sm text-muted-foreground text-center">Follow these steps to get facility recommendations.</p>
                <ol className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">1</span>
                    <div>
                      <p className="font-medium text-foreground">Geocode</p>
                      <p className="text-sm text-muted-foreground">Set project location and geocode facilities so we can compute distances.</p>
                      <div className="flex flex-wrap gap-2 mt-2">
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
                          disabled={geoAction !== "idle" || (status?.facility_ids_without_geocode?.length ?? 0) === 0}
                          onClick={handleGeocodeMissingFacilities}
                        >
                          Geocode facilities
                        </Button>
                      </div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">2</span>
                    <div>
                      <p className="font-medium text-foreground">Compute distances</p>
                      <p className="text-sm text-muted-foreground">Calculate project → facility distances (or run optimiser to do this automatically).</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={geoAction !== "idle" || (status?.facilities_total ?? 0) === 0}
                        onClick={handleRecomputeDistances}
                      >
                        Recompute distances
                      </Button>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">3</span>
                    <div>
                      <p className="font-medium text-foreground">Run optimiser</p>
                      <p className="text-sm text-muted-foreground">Rank facilities by distance, cost, and carbon using the weights above.</p>
                      <Button
                        className="mt-2 gap-2"
                        disabled={runLoading || loading || noStreams || noFacilities}
                        onClick={handleRunClick}
                      >
                        {runLoading ? (runPhase === "computing" ? "Computing distances…" : "Ranking facilities…") : "Run optimiser"}
                      </Button>
                    </div>
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border/50 overflow-hidden">
              <div className="overflow-x-auto" style={{ minWidth: 0 }}>
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="min-w-[80px] font-medium">Stream</TableHead>
                      <TableHead className="min-w-[140px] font-medium">Facility</TableHead>
                      <TableHead className="min-w-[72px] text-center font-medium">Score</TableHead>
                      <TableHead className="min-w-[72px] text-right font-medium">Distance</TableHead>
                      <TableHead className="min-w-[72px] text-right font-medium">Carbon</TableHead>
                      <TableHead className="min-w-[160px] font-medium">Reason</TableHead>
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
                      const explainOpen = expandedExplainStream === row.stream_name;
                      return (
                        <React.Fragment key={row.stream_name}>
                        <TableRow className="border-border/50">
                          <TableCell className="font-medium">{row.stream_name}</TableCell>
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
                          <TableCell className="text-center align-top">
                            {row.score != null && row.recommended_facility_id && selectedId === row.recommended_facility_id ? (
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                                  row.score >= 0.7 && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                                  row.score >= 0.4 && row.score < 0.7 && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                                  row.score > 0 && row.score < 0.4 && "bg-rose-500/15 text-rose-700 dark:text-rose-400",
                                  row.score === 0 && "bg-muted text-muted-foreground"
                                )}
                                title="Composite score 0–1 (higher is better)"
                              >
                                {Math.round((row.score ?? 0) * 100)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground align-top">
                            {runLoading ? (
                              <span className="text-muted-foreground">…</span>
                            ) : row.distance_km != null ? (
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
                                  <span title="Run optimiser again to compute distances, or use Recompute distances in Location status.">Not computed</span>
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
                            {row.estimated_carbon != null ? `${row.estimated_carbon.toFixed(2)} tCO2e` : "—"}
                          </TableCell>
                          <TableCell className="min-w-0 w-[1%] align-top">
                            <div className="flex flex-col gap-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => setExpandedExplainStream(explainOpen ? null : row.stream_name)}
                                className={cn(
                                  "inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline text-left whitespace-nowrap",
                                  explainOpen && "text-foreground"
                                )}
                              >
                                {explainOpen ? (
                                  <ChevronDown className="size-4 shrink-0" aria-hidden />
                                ) : (
                                  <ChevronRight className="size-4 shrink-0" aria-hidden />
                                )}
                                Explain recommendation
                              </button>
                              <span
                                title={row.reason.breakdown?.length ? row.reason.breakdown.join("\n") : row.reason.primary}
                                className="line-clamp-2 text-xs text-muted-foreground"
                              >
                                {row.reason.primary}
                                <Info className="size-3.5 inline shrink-0 align-middle ml-0.5" aria-hidden />
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                        {explainOpen && (
                          <TableRow className="border-border/50 bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={6} className="py-4 px-6">
                              <p className="text-sm font-medium text-foreground mb-2">Why this facility ranked highest</p>
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                {(row.reason.breakdown ?? [row.reason.primary]).map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                              </ul>
                            </TableCell>
                          </TableRow>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleAutoApply}
                disabled={applyLoading}
                variant="default"
                className="gap-2 shrink-0"
              >
                <CheckCircle2 className="size-4" />
                {applyLoading ? "Applying…" : "Auto-apply recommendations"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setApplyDialogOpen(true)}
                disabled={applyLoading}
                className="gap-2 shrink-0"
              >
                <MapPin className="size-4" />
                Apply selected
              </Button>
              <p className="text-sm text-muted-foreground min-w-0 basis-full sm:basis-auto">
                Auto-apply uses the recommended facility per stream; Apply selected uses your table choices.
              </p>
            </div>
            {typeof process.env.NEXT_PUBLIC_DEBUG_DISTANCES !== "undefined" &&
              process.env.NEXT_PUBLIC_DEBUG_DISTANCES === "true" &&
              debugDistances != null && (
              <p className="text-xs text-muted-foreground mt-2" aria-hidden>
                Distances loaded: {debugDistances.loaded}/{debugDistances.total}
              </p>
            )}
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
