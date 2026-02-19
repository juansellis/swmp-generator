"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";
import { buildWasteChartData } from "@/lib/wasteChartData";
import type { SwmpInputsForChart } from "@/lib/wasteChartData";
import type {
  WasteStrategyResult,
  StrategyRecommendation,
  StreamPlanItem,
} from "@/lib/planning/wasteStrategyBuilder";
import type { PlanningChecklist } from "@/lib/planning/planningChecklist";
import type { ReportSection } from "./report-section-header";
import { ReportSectionHeader } from "./report-section-header";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProjectHeader } from "@/components/project-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WasteDistributionPie } from "@/components/charts/WasteDistributionPie";
import { DiversionOutcomePie } from "@/components/charts/DiversionOutcomePie";
import { WasteComparisonBar } from "@/components/charts/WasteComparisonBar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PriorityChip, type PriorityLevel } from "@/components/ui/priority-chip";
import { DecisionChip, type DecisionChipState } from "@/components/ui/decision-chip";
import { useProjectContext } from "@/app/projects/[id]/project-context";
import { StreamPlanningCards, type OptimiserStream, type StreamFilterState } from "./stream-planning-cards";
import { isRecommendationResolved } from "./recommendation-helpers";
import { toast } from "sonner";
import { CheckCircle2, Circle, AlertCircle, FileDown, ListChecks, RefreshCw } from "lucide-react";

const CARD_CLASS =
  "overflow-hidden rounded-xl border border-border shadow-sm print:shadow-none print:border print:bg-white";
const SECTION_SPACE = "space-y-10";

/** Catches render errors in a section so one broken section does not blank the whole Report page. */
class SectionErrorBoundary extends React.Component<
  { sectionId: string; children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false as const, error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.error(`[Report section "${this.props.sectionId}"]`, error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className={CARD_CLASS}>
          <CardContent className="p-6">
            <p className="text-sm text-destructive">
              This section could not be displayed. Check the console for details.
            </p>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

type SwmpRow = {
  id: string;
  version: number;
  content_html: string | null;
  created_at: string;
};

type ForecastItemRow = {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  excess_percent: number;
  waste_stream_key: string | null;
  computed_waste_kg?: number | null;
};

function RecommendationDetail({
  rec,
  projectId,
  onApplied,
  isResolved = false,
}: {
  rec: StrategyRecommendation;
  projectId: string;
  onApplied: (result: WasteStrategyResult) => void;
  isResolved?: boolean;
}) {
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const impact = rec.estimated_impact;
  const notes =
    impact?.notes && Array.isArray(impact.notes)
      ? impact.notes
      : impact?.notes
        ? [impact.notes]
        : [];
  const hasApply = Boolean(rec.apply_action) && !isResolved;

  const handleApply = useCallback(async () => {
    if (!rec.apply_action) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/recommendations/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recommendationId: rec.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyError(data?.error ?? "Failed to apply");
        return;
      }
      onApplied(data as WasteStrategyResult);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }, [projectId, rec.id, rec.apply_action, onApplied]);

  return (
    <div className="space-y-3 text-sm pt-3 border-t border-border">
      <p className="text-muted-foreground">{rec.description}</p>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {hasApply && (
          <Button variant="default" size="sm" onClick={handleApply} disabled={applying}>
            {applying ? "Applying…" : "Apply"}
          </Button>
        )}
        {(rec.triggers?.length > 0 || impact || (rec.implementation_steps?.length ?? 0) > 0) && (
          <Accordion type="single" collapsible className="w-full max-w-[200px]">
            <AccordionItem value="details" className="border-none">
              <AccordionTrigger className="py-0 text-xs text-muted-foreground hover:no-underline">
                Details
              </AccordionTrigger>
              <AccordionContent className="pb-0 pt-1">
                <div className="space-y-2 text-xs">
                  {rec.confidence && <p className="text-muted-foreground">Confidence: {rec.confidence}</p>}
                  {rec.triggers?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rec.triggers.map((t, j) => (
                        <Badge key={j} variant="secondary" className="text-xs font-normal">
                          {t.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {impact && (
                    <div className="rounded-md border bg-muted/20 p-2">
                      <p className="font-medium text-muted-foreground">Estimated impact</p>
                      <ul className="mt-1 list-inside space-y-0.5">
                        {impact.tonnes_diverted != null && (
                          <li>Tonnes diverted: {impact.tonnes_diverted.toFixed(1)} t</li>
                        )}
                        {impact.diversion_delta_percent != null && (
                          <li>Diversion delta: {impact.diversion_delta_percent.toFixed(0)}%</li>
                        )}
                        {impact.cost_savings_nzd_range && (
                          <li>
                            Cost: ${impact.cost_savings_nzd_range[0]} – ${impact.cost_savings_nzd_range[1]} NZD
                          </li>
                        )}
                        {impact.carbon_savings_tco2e_range && (
                          <li>
                            Carbon: {impact.carbon_savings_tco2e_range[0]} – {impact.carbon_savings_tco2e_range[1]} tCO2e
                          </li>
                        )}
                        {notes.map((n, k) => (
                          <li key={k} className="text-muted-foreground">{n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rec.implementation_steps?.length > 0 && (
                    <div>
                      <p className="mb-1 font-medium text-muted-foreground">Steps</p>
                      <ol className="list-inside list-decimal space-y-0.5 text-muted-foreground">
                        {rec.implementation_steps.map((step, j) => (
                          <li key={j}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
      {applyError && (
        <p className="text-xs text-destructive">{applyError}</p>
      )}
    </div>
  );
}

const PRIORITY_OPTIONS = ["all", "high", "medium", "low"] as const;
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "source_separation", label: "Source separation" },
  { value: "facility_optimisation", label: "Facility optimisation" },
  { value: "procurement_reduction", label: "Procurement reduction" },
  { value: "site_logistics", label: "Site logistics" },
  { value: "data_quality", label: "Data quality" },
  { value: "contractor_engagement", label: "Contractor engagement" },
  { value: "documentation", label: "Documentation" },
];

export default function SwmpPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params?.id;

  const section = (searchParams.get("section") ?? "overview") as ReportSection;
  const exportMode = searchParams.get("export") === "1";
  const projectContext = useProjectContext();
  const projectName = projectContext?.project?.name ?? "Project";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swmp, setSwmp] = useState<SwmpRow | null>(null);
  const [chartInputs, setChartInputs] = useState<SwmpInputsForChart | null>(null);
  const [wasteStrategy, setWasteStrategy] = useState<WasteStrategyResult | null>(null);
  const [forecastItems, setForecastItems] = useState<ForecastItemRow[]>([]);
  const [planningChecklist, setPlanningChecklist] = useState<PlanningChecklist | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [distanceStatus, setDistanceStatus] = useState<{ count: number; last_updated_at: string | null } | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distancesRecomputing, setDistancesRecomputing] = useState(false);
  const [strategySectionLoading, setStrategySectionLoading] = useState(false);
  const [forecastSectionLoading, setForecastSectionLoading] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [optimiserData, setOptimiserData] = useState<{
    facilities_geocoded: number;
    facilities_total: number;
    distances_cached: number;
    last_updated_at: string | null;
    streams: OptimiserStream[];
  } | null>(null);
  const [optimiserLoading, setOptimiserLoading] = useState(false);
  const [applyFacilityStream, setApplyFacilityStream] = useState<string | null>(null);

  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [streamFilterState, setStreamFilterState] = useState<StreamFilterState>({
    search: "",
    filter: "all",
    handling: "all",
    sort: "tonnes",
  });
  const [streamsViewMode, setStreamsViewMode] = useState<"cards" | "table">("cards");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfFallbackModalOpen, setPdfFallbackModalOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("swmp-streams-view") as "cards" | "table" | null;
      if (stored === "cards" || stored === "table") setStreamsViewMode(stored);
    } catch {
      /* ignore */
    }
  }, []);
  const setStreamsViewModePersisted = useCallback((mode: "cards" | "table") => {
    setStreamsViewMode(mode);
    try {
      localStorage.setItem("swmp-streams-view", mode);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchWasteStrategy = useCallback(async (id: string) => {
    setStrategyError(null);
    if (process.env.NODE_ENV === "development") {
      console.time("[perf] strategy fetch");
    }
    const res = await fetch(`/api/projects/${id}/waste-strategy`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = typeof (data as { error?: string }).error === "string" ? (data as { error: string }).error : "Failed to load strategy";
      setStrategyError(message);
      setWasteStrategy(null);
      if (process.env.NODE_ENV === "development") {
        console.timeEnd("[perf] strategy fetch");
      }
      return;
    }
    setWasteStrategy(data as WasteStrategyResult);
    if (process.env.NODE_ENV === "development") {
      console.timeEnd("[perf] strategy fetch");
    }
  }, []);

  const fetchPlanningChecklist = useCallback(async (id: string) => {
    setChecklistLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/planning-checklist`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as PlanningChecklist;
      setPlanningChecklist(data);
    } finally {
      setChecklistLoading(false);
    }
  }, []);

  const fetchDistanceStatus = useCallback(async (id: string) => {
    setDistanceLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/distances`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number; last_updated_at?: string | null; facilities_total?: number; facilities_geocoded?: number };
      setDistanceStatus({
        count: typeof data.count === "number" ? data.count : 0,
        last_updated_at: data.last_updated_at ?? null,
      });
    } finally {
      setDistanceLoading(false);
    }
  }, []);

  const fetchFacilityOptimiser = useCallback(async (id: string) => {
    setOptimiserLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/facility-optimiser`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        facilities_geocoded?: number;
        facilities_total?: number;
        distances_cached?: number;
        last_updated_at?: string | null;
        streams?: OptimiserStream[];
      };
      setOptimiserData({
        facilities_geocoded: data.facilities_geocoded ?? 0,
        facilities_total: data.facilities_total ?? 0,
        distances_cached: data.distances_cached ?? 0,
        last_updated_at: data.last_updated_at ?? null,
        streams: data.streams ?? [],
      });
    } finally {
      setOptimiserLoading(false);
    }
  }, []);

  const fetchForecastItems = useCallback(async (id: string) => {
    const res = await fetch(`/api/projects/${id}/forecast-items`, { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: ForecastItemRow[] };
    setForecastItems(data.items ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      setChartInputs(null);
      setWasteStrategy(null);
      setStrategyError(null);
      setForecastItems([]);
      setPlanningChecklist(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      if (!projectId) {
        setError("Missing project id.");
        setLoading(false);
        return;
      }

      const [swmpResult, inputsResult] = await Promise.all([
        supabase
          .from("swmps")
          .select("id, version, content_html, created_at")
          .eq("project_id", projectId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("swmp_inputs")
          .select(SWMP_INPUTS_JSON_COLUMN)
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!mounted) return;

      if (swmpResult.error) {
        setError(swmpResult.error.message);
        setSwmp(null);
      } else {
        setSwmp((swmpResult.data as SwmpRow) ?? null);
      }

      const inputsRow = inputsResult.data as { inputs?: SwmpInputsForChart } | null;
      setChartInputs(inputsRow?.inputs ?? null);
      setStrategySectionLoading(true);
      setForecastSectionLoading(true);
      fetchWasteStrategy(projectId).then(() => {
        if (mounted) setStrategySectionLoading(false);
      });
      fetchForecastItems(projectId).then(() => {
        if (mounted) setForecastSectionLoading(false);
      });
      fetchPlanningChecklist(projectId);
      fetchDistanceStatus(projectId);
      fetchFacilityOptimiser(projectId);
      fetch("/api/auth/check-admin", { credentials: "include" })
        .then((r) => r.json())
        .then((body: { isSuperAdmin?: boolean }) => {
          if (!mounted) return;
          if (typeof body?.isSuperAdmin === "boolean") setIsSuperAdmin(body.isSuperAdmin);
        })
        .catch(() => {});
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router, projectId, fetchWasteStrategy, fetchForecastItems, fetchPlanningChecklist, fetchDistanceStatus, fetchFacilityOptimiser]);

  const chartData = useMemo(
    () => buildWasteChartData(chartInputs),
    [chartInputs]
  );

  const filteredRecommendations = useMemo(() => {
    if (!wasteStrategy?.recommendations) return [];
    let list = wasteStrategy.recommendations;
    if (priorityFilter !== "all") {
      list = list.filter((r) => r.priority === priorityFilter);
    }
    if (categoryFilter !== "all") {
      list = list.filter((r) => r.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [wasteStrategy?.recommendations, priorityFilter, categoryFilter, searchQuery]);

  /** Facility id -> name from optimiser (assigned + nearest). Used for Facility column in tables. */
  const facilitiesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of optimiserData?.streams ?? []) {
      if (s.assigned_facility_id && s.assigned_facility_name) {
        map.set(s.assigned_facility_id, s.assigned_facility_name);
      }
      for (const n of s.nearest) {
        map.set(n.facility_id, n.facility_name);
      }
    }
    return map;
  }, [optimiserData?.streams]);

  /** Strict destination display: only actual selected destination. Never partner/recommendation as selected. */
  function getDestinationDisplay(plan: StreamPlanItem, optimiserStream?: OptimiserStream | null): string {
    const fromOptimiser = optimiserStream?.assigned_destination_display;
    if (fromOptimiser != null && fromOptimiser.trim() !== "") return fromOptimiser;
    if (plan.destination_mode === "custom") {
      const name = (plan.custom_destination_name ?? "").trim();
      const addr = (plan.custom_destination_address ?? "").trim();
      if (name || addr) return name || addr;
    }
    if (plan.destination_mode === "facility" && plan.assigned_facility_id) {
      const name = facilitiesById.get(plan.assigned_facility_id);
      if (name) return name;
    }
    return "No destination selected.";
  }

  const appendixData = useMemo(() => {
    const byStream = new Map<string, ForecastItemRow[]>();
    const unallocated: ForecastItemRow[] = [];
    const conversionRequired: ForecastItemRow[] = [];
    for (const item of forecastItems) {
      const key = (item.waste_stream_key ?? "").trim();
      if (!key) {
        unallocated.push(item);
        continue;
      }
      const convertible =
        item.computed_waste_kg != null &&
        Number.isFinite(item.computed_waste_kg) &&
        item.computed_waste_kg >= 0;
      if (!convertible) conversionRequired.push(item);
      if (!byStream.has(key)) byStream.set(key, []);
      byStream.get(key)!.push(item);
    }
    return { byStream, unallocated, conversionRequired };
  }, [forecastItems]);

  const setExportMode = useCallback(
    (on: boolean) => {
      const next = new URLSearchParams(searchParams.toString());
      if (on) next.set("export", "1");
      else next.delete("export");
      router.replace(`/projects/${projectId}/swmp?${next.toString()}`, { scroll: false });
    },
    [projectId, router, searchParams]
  );

  const handlePlanPatch = useCallback(
    async (
      streamName: string,
      patch: { handling_mode?: "mixed" | "separated"; intended_outcomes?: string[] }
    ) => {
      if (!projectId) return;
      const res = await fetch(
        `/api/projects/${projectId}/streams/${encodeURIComponent(streamName)}/plan`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) throw new Error("Failed to update plan");
    },
    [projectId]
  );

  const handleApplyRecommendation = useCallback(
    async (recId: string) => {
      if (!projectId) return;
      const res = await fetch(`/api/projects/${projectId}/recommendations/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recommendationId: recId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to apply");
      setWasteStrategy(data as WasteStrategyResult);
      fetchPlanningChecklist(projectId);
      fetchFacilityOptimiser(projectId);
      fetchWasteStrategy(projectId);
    },
    [projectId, fetchPlanningChecklist, fetchFacilityOptimiser, fetchWasteStrategy]
  );

  const handleComputeDistances = useCallback(async () => {
    if (!projectId) return;
    setDistancesRecomputing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/distances/recompute`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await fetchDistanceStatus(projectId);
        await fetchFacilityOptimiser(projectId);
      }
    } finally {
      setDistancesRecomputing(false);
    }
  }, [projectId, fetchDistanceStatus, fetchFacilityOptimiser]);

  const handleResetFacility = useCallback(
    async (streamName: string) => {
      if (!projectId) return;
      const res = await fetch(
        `/api/projects/${projectId}/streams/${encodeURIComponent(streamName)}/facility`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ facility_id: null }),
        }
      );
      if (!res.ok) throw new Error("Failed to reset facility");
      setOptimiserData((prev) =>
        prev
          ? {
              ...prev,
              streams: prev.streams.map((st) =>
                st.stream_name === streamName
                  ? {
                      ...st,
                      assigned_facility_id: null,
                      assigned_facility_name: null,
                      assigned_distance_km: null,
                      assigned_duration_min: null,
                    }
                  : st
              ),
            }
          : null
      );
      setWasteStrategy((prev) =>
        prev
          ? {
              ...prev,
              streamPlans: (prev.streamPlans ?? []).map((sp) =>
                sp.stream_name === streamName ? { ...sp, assigned_facility_id: null } : sp
              ),
            }
          : null
      );
      fetchWasteStrategy(projectId);
      fetchPlanningChecklist(projectId);
      fetchFacilityOptimiser(projectId);
    },
    [projectId, fetchWasteStrategy, fetchPlanningChecklist, fetchFacilityOptimiser]
  );

  const handleApplyFacility = useCallback(
    async (streamName: string, facilityId: string) => {
      if (!projectId) return;
      setApplyFacilityStream(streamName);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/streams/${encodeURIComponent(streamName)}/facility`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ facility_id: facilityId }),
          }
        );
        if (!res.ok) throw new Error("Failed to set facility");
        const optStream = optimiserData?.streams?.find((s) => s.stream_name === streamName);
        const nearest = optStream?.nearest?.find(
          (n: { facility_id: string; facility_name: string; distance_km: number; duration_min: number }) =>
            n.facility_id === facilityId
        );
        if (optimiserData && nearest) {
          setOptimiserData((prev) =>
            prev
              ? {
                  ...prev,
                  streams: prev.streams.map((st) =>
                    st.stream_name === streamName
                      ? {
                          ...st,
                          assigned_facility_id: nearest.facility_id,
                          assigned_facility_name: nearest.facility_name,
                          assigned_distance_km: nearest.distance_km,
                          assigned_duration_min: nearest.duration_min,
                        }
                      : st
                  ),
                }
              : null
          );
        }
        setWasteStrategy((prev) =>
          prev
            ? {
                ...prev,
                streamPlans: (prev.streamPlans ?? []).map((sp) =>
                  sp.stream_name === streamName ? { ...sp, assigned_facility_id: facilityId } : sp
                ),
              }
            : null
        );
        fetchWasteStrategy(projectId);
        fetchPlanningChecklist(projectId);
        fetchFacilityOptimiser(projectId);
      } finally {
        setApplyFacilityStream(null);
      }
    },
    [
      projectId,
      optimiserData?.streams,
      fetchWasteStrategy,
      fetchPlanningChecklist,
      fetchFacilityOptimiser,
    ]
  );

  const validSection = ["overview", "strategy", "streams", "narrative", "appendix"].includes(section)
    ? section
    : "overview";

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className={SECTION_SPACE}>
          <ProjectHeader />
          <PageHeader title="Report" />
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const showSection = (s: ReportSection) => exportMode || validSection === s;

  return (
    <AppShell>
      <div className={SECTION_SPACE}>
        <div className="print:hidden space-y-2">
          <ProjectHeader />
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between flex-wrap">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Report</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {projectName}
                  {swmp?.created_at
                    ? ` • Last updated ${new Date(swmp.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}`
                    : " • Not generated yet"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={swmp ? "default" : "secondary"} className="shrink-0">
                  {swmp ? "Ready" : "Needs attention"}
                </Badge>
                {swmp && (
                  <>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/projects/${projectId}/swmp?export=1`}>
                        <FileDown className="size-4 mr-2" />
                        View print layout
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      disabled={pdfDownloading}
                      onClick={async () => {
                        if (!projectId) return;
                        setPdfDownloading(true);
                        try {
                          const res = await fetch(`/api/report/pdf?projectId=${encodeURIComponent(projectId)}`, {
                            credentials: "include",
                          });
                          if (!res.ok) {
                            const b = await res.json().catch(() => ({})) as { error?: string; code?: string };
                            if (b.code === "PLAYWRIGHT_NOT_INSTALLED" || (b.error && (b.error.includes("not configured") || b.error.includes("playwright install")))) {
                              setPdfFallbackModalOpen(true);
                              return;
                            }
                            throw new Error(b.error ?? "PDF failed");
                          }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `SWMP-${projectId.slice(0, 8)}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success("PDF downloaded");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "PDF download failed");
                        } finally {
                          setPdfDownloading(false);
                        }
                      }}
                    >
                      <FileDown className="size-4 mr-2" />
                      {pdfDownloading ? "Generating…" : "Download PDF"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <Dialog open={pdfFallbackModalOpen} onOpenChange={setPdfFallbackModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>PDF engine missing</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              PDF export is not configured on this environment. Use Print → Save as PDF instead.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={() => {
                  if (projectId) window.open(`/projects/${projectId}/report/export`, "_blank");
                  setPdfFallbackModalOpen(false);
                }}
              >
                Open print view
              </Button>
              <Button variant="outline" onClick={() => setPdfFallbackModalOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ReportSectionHeader
          currentSection={validSection}
          exportMode={exportMode}
          onExportClick={() => setExportMode(!exportMode)}
        />

        {((wasteStrategy?.conversionsUsed?.usedFallback) ||
          (wasteStrategy?.conversionsUsed?.fallbackCount ?? 0) > 0) && (
          <Alert className="max-w-5xl mx-auto px-4 mb-4 border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30 print:hidden">
            <AlertTitle className="text-amber-800 dark:text-amber-200">Note</AlertTitle>
            <AlertDescription>
              <span className="block mb-1">
                Some streams used default density values. Configure conversion factors in{" "}
                <Link href="/admin/conversions" className="underline font-medium">
                  Management → Conversion factors
                </Link>
                .
              </span>
              {wasteStrategy?.conversionsUsed?.missingKeys?.length ? (
                <span className="text-sm">
                  Affected streams:{" "}
                  {wasteStrategy.conversionsUsed.missingKeys.slice(0, 5).join(", ")}
                  {wasteStrategy.conversionsUsed.missingKeys.length > 5 &&
                    ` and ${wasteStrategy.conversionsUsed.missingKeys.length - 5} more`}
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        <div
          className={`max-w-5xl mx-auto px-4 pb-10 ${SECTION_SPACE}`}
          data-export
        >
          {/* ---------- OVERVIEW ---------- */}
          {showSection("overview") && (
            <section id="outputs-overview" className="print:break-before-auto">
              <h1 className="text-2xl font-semibold mb-2">Overview</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Key metrics and top recommendations at a glance.
              </p>
              <SectionErrorBoundary sectionId="overview">
              <div className={SECTION_SPACE}>
                {/* Planning Checklist */}
                {checklistLoading ? (
                  <Card className={CARD_CLASS}>
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">Loading planning checklist…</p>
                    </CardContent>
                  </Card>
                ) : planningChecklist ? (
                  <Card className={CARD_CLASS}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-2">
                        <ListChecks className="size-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Project Planning Checklist</CardTitle>
                      </div>
                      <Badge variant={planningChecklist.readiness_score === 100 ? "default" : "secondary"} className="tabular-nums">
                        {planningChecklist.readiness_score}% ready
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {planningChecklist.items.map((item) => {
                          const Icon =
                            item.status === "complete"
                              ? CheckCircle2
                              : item.status === "blocked"
                                ? AlertCircle
                                : Circle;
                          return (
                            <li
                              key={item.key}
                              className={cn(
                                "flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm",
                                item.status === "complete" && "border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20",
                                item.status === "blocked" && "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
                              )}
                            >
                              <Icon
                                className={cn(
                                  "size-4 shrink-0",
                                  item.status === "complete" && "text-green-600 dark:text-green-500",
                                  item.status === "blocked" && "text-amber-600 dark:text-amber-500",
                                  item.status === "incomplete" && "text-muted-foreground"
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <span className="font-medium">{item.label}</span>
                                {item.detail && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                                )}
                              </div>
                              {item.count != null && item.count > 0 && (
                                <Badge variant="outline" className="shrink-0">
                                  {item.count}
                                </Badge>
                              )}
                              {item.cta && item.status !== "complete" && (
                                <Button variant="outline" size="sm" className="shrink-0" asChild>
                                  <Link
                                    href={item.cta.href ?? `/projects/${projectId}/inputs`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {item.cta.label}
                                  </Link>
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {planningChecklist.readiness_score === 100 && planningChecklist.items.some((i) => i.key === "export_ready" && i.status === "complete") && (
                        <div className="pt-2">
                          <Button variant="default" size="lg" className="w-full sm:w-auto" asChild>
                            <Link href={`/projects/${projectId}/swmp?export=1`}>
                              <FileDown className="size-4 mr-2" />
                              Export SWMP
                            </Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                {wasteStrategy && wasteStrategy.summary && (
                  <Card className={CARD_CLASS}>
                    <CardContent className="p-6">
                      <h2 className="text-lg font-semibold mb-4">Summary</h2>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                        {[
                          {
                            label: "Total tonnes",
                            value: (wasteStrategy.summary.total_estimated_tonnes ?? 0).toFixed(1),
                          },
                          {
                            label: "Diversion %",
                            value: `${(wasteStrategy.summary.estimated_diversion_percent ?? 0).toFixed(0)}%`,
                          },
                          {
                            label: "Landfill %",
                            value: `${(wasteStrategy.summary.estimated_landfill_percent ?? 0).toFixed(0)}%`,
                          },
                          {
                            label: "Streams",
                            value: String(wasteStrategy.summary.streams_count ?? 0),
                          },
                          {
                            label: "Facilities utilised",
                            value: String(wasteStrategy.summary.facilities_utilised_count ?? 0),
                          },
                        ].map(({ label, value }) => (
                          <div
                            key={label}
                            className="rounded-lg border bg-muted/30 p-3"
                          >
                            <p className="text-xs font-medium text-muted-foreground">
                              {label}
                            </p>
                            <p className="text-lg font-semibold tabular-nums">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <WasteDistributionPie data={chartData.wasteDistribution} />
            <DiversionOutcomePie data={chartData.diversionSummary} />
                </div>

                {wasteStrategy && (wasteStrategy.recommendations?.length ?? 0) > 0 && (
                  <Card className={CARD_CLASS}>
                    <CardHeader>
                      <CardTitle className="text-lg">Top 3 recommendations</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Preview of highest-priority actions.
                      </p>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {(wasteStrategy.recommendations ?? [])
                          .slice(0, 3)
                          .map((r, i) => (
                            <li key={r.id ?? i}>{r.title}</li>
                          ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
            </div>
              </SectionErrorBoundary>
          </section>
          )}

          {/* ---------- STRATEGY ---------- */}
          {showSection("strategy") && (
            <section id="outputs-strategy" className="print:break-before-auto">
              <h1 className="text-2xl font-semibold mb-2">Strategy</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Waste strategy recommendations and stream plans.
              </p>
              <SectionErrorBoundary sectionId="strategy">
              {strategySectionLoading && !wasteStrategy ? (
                <Card className={CARD_CLASS}>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">Loading strategy…</p>
                  </CardContent>
                </Card>
              ) : strategyError ? (
                <Card className={CARD_CLASS}>
                  <CardContent className="p-6 space-y-3">
                    <p className="text-sm text-destructive">{strategyError}</p>
                    <Button variant="outline" size="sm" onClick={() => projectId && fetchWasteStrategy(projectId)}>
                      <RefreshCw className="size-4 mr-2" />
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : !wasteStrategy ? (
                <Card className={CARD_CLASS}>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">
                      No strategy data yet. Save your inputs and ensure waste streams are configured to generate recommendations.
                    </p>
                  </CardContent>
                </Card>
              ) : (
              <div className={SECTION_SPACE}>
                <Card className={CARD_CLASS}>
                  <CardHeader>
                    <CardTitle className="text-lg">Recommendations</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Filter by priority, category, or search.
                    </p>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    {!exportMode && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        <Select
                          value={priorityFilter}
                          onValueChange={setPriorityFilter}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p === "all" ? "All" : p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={categoryFilter}
                          onValueChange={setCategoryFilter}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Search…"
                          className="max-w-[200px]"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    )}
                    {filteredRecommendations.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        No recommendations match the filters.
                      </p>
                    ) : (
                      <Accordion type="single" collapsible defaultValue="">
                        {filteredRecommendations.map((rec, i) => {
                          const resolved = isRecommendationResolved(rec, wasteStrategy.streamPlans ?? []);
                          return (
                            <AccordionItem
                              key={rec.id ?? i}
                              value={rec.id ?? `rec-${i}`}
                              className={resolved ? "opacity-75" : undefined}
                            >
                              <AccordionTrigger className="text-left">
                                <span className="flex flex-wrap items-center gap-2">
                                  {resolved ? (
                                    <Badge variant="secondary" className="font-normal text-muted-foreground shrink-0">
                                      Resolved
                                    </Badge>
                                  ) : (
                                    <PriorityChip level={rec.priority as PriorityLevel} />
                                  )}
                                  <Badge variant="outline" className="font-normal shrink-0">
                                    {String(rec.category).replace(/_/g, " ")}
                                  </Badge>
                                  <span className={cn("min-w-0", resolved && "text-muted-foreground")}>
                                    {rec.title}
                                  </span>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className={resolved ? "text-muted-foreground" : undefined}>
                                <RecommendationDetail
                                  rec={rec}
                                  projectId={projectId}
                                  onApplied={(result) => {
                                setWasteStrategy(result);
                                if (projectId) fetchPlanningChecklist(projectId);
                              }}
                                  isResolved={resolved}
                                />
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    )}
                  </CardContent>
                </Card>
              </div>
              )}
              </SectionErrorBoundary>
            </section>
          )}

          {/* ---------- WASTE STREAMS (planning cards or print table) ---------- */}
          {showSection("streams") && (
            <section id="outputs-streams" className="print:break-before-auto">
              <h1 className="text-2xl font-semibold mb-2">Waste Streams</h1>
              <p className="text-sm text-muted-foreground mb-6">
                {exportMode
                  ? "Stream summary with tonnes and destinations."
                  : "Set handling and facility per stream. Use cards to choose facilities and see recommendations."}
              </p>
              <SectionErrorBoundary sectionId="streams">
              {strategySectionLoading && !wasteStrategy ? (
                <Card className={CARD_CLASS}>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">Loading waste streams…</p>
                  </CardContent>
                </Card>
              ) : strategyError ? (
                <Card className={CARD_CLASS}>
                  <CardContent className="p-6 space-y-3">
                    <p className="text-sm text-destructive">{strategyError}</p>
                    <Button variant="outline" size="sm" onClick={() => projectId && fetchWasteStrategy(projectId)}>
                      <RefreshCw className="size-4 mr-2" />
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : !wasteStrategy ? (
                <Card className={CARD_CLASS}>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">
                      Not provided yet. Save your inputs and configure waste streams in Inputs.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" asChild>
                      <Link href={`/projects/${projectId}/inputs#waste-streams`}>Go to Inputs</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {!exportMode && (
                    <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5 w-fit mb-4">
                      <Button
                        variant={streamsViewMode === "cards" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setStreamsViewModePersisted("cards")}
                      >
                        Cards
                      </Button>
                      <Button
                        variant={streamsViewMode === "table" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setStreamsViewModePersisted("table")}
                      >
                        Table
                      </Button>
                    </div>
                  )}
                  {(exportMode || streamsViewMode === "table") ? (
                    <Card className={CARD_CLASS}>
                      <CardContent className="p-6">
                        <div className="overflow-x-auto rounded-md border min-w-0">
                          <Table className="table-fixed w-full text-sm">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[18%] px-3 py-3 font-medium whitespace-normal">Stream</TableHead>
                                <TableHead className="w-[9%] px-3 py-3 text-right font-medium">Manual (t)</TableHead>
                                <TableHead className="w-[9%] px-3 py-3 text-right font-medium">Forecast (t)</TableHead>
                                <TableHead className="w-[9%] px-3 py-3 text-right font-medium">Total (t)</TableHead>
                                <TableHead className="w-[16%] px-3 py-3 font-medium">Handling</TableHead>
                                <TableHead className="w-[24%] px-3 py-3 font-medium">Destination</TableHead>
                                <TableHead className="w-[10%] px-3 py-3 text-right font-medium">Distance (km)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(wasteStrategy.streamPlans ?? []).map((s) => {
                                const optimiserStream = optimiserData?.streams?.find((st) => st.stream_name === s.stream_name);
                                const destinationLabel = getDestinationDisplay(s, optimiserStream ?? null);
                                const displayDestination = destinationLabel && destinationLabel !== "No destination selected." ? destinationLabel : "No destination selected.";
                                const distanceKm =
                                  (s.distance_km != null && Number.isFinite(s.distance_km)) ? s.distance_km : (optimiserStream?.assigned_distance_km ?? null);
                                const handlingChipState: DecisionChipState =
                                  s.handling_mode === "separated" ? "separated" : s.handling_mode === "mixed" ? "mixed" : "missing";
                                return (
                                  <TableRow key={s.stream_id} className="border-b border-border">
                                    <TableCell className="px-3 py-4 font-medium align-middle">{s.stream_name}</TableCell>
                                    <TableCell className="px-3 py-4 text-right tabular-nums align-middle">{s.manual_tonnes.toFixed(1)}</TableCell>
                                    <TableCell className="px-3 py-4 text-right tabular-nums align-middle">{s.forecast_tonnes.toFixed(1)}</TableCell>
                                    <TableCell className="px-3 py-4 text-right tabular-nums align-middle">{s.total_tonnes.toFixed(1)}</TableCell>
                                    <TableCell className="px-3 py-4 align-middle">
                                      <DecisionChip state={handlingChipState} />
                                    </TableCell>
                                    <TableCell className="px-3 py-4 align-middle text-muted-foreground truncate max-w-[200px]">
                                      {displayDestination}
                                    </TableCell>
                                    <TableCell className="px-3 py-4 text-right tabular-nums align-middle text-muted-foreground">
                                      {distanceKm != null && Number.isFinite(distanceKm) ? distanceKm.toFixed(1) : "—"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                  <StreamPlanningCards
                    wasteStrategy={wasteStrategy}
                    optimiserData={optimiserData}
                    projectId={projectId}
                    isSuperAdmin={isSuperAdmin}
                    applyFacilityStream={applyFacilityStream}
                    getDestinationDisplay={getDestinationDisplay}
                    onApplyFacility={handleApplyFacility}
                    onResetFacility={handleResetFacility}
                    onRefetch={() => {
                      fetchWasteStrategy(projectId);
                      fetchFacilityOptimiser(projectId);
                      fetchPlanningChecklist(projectId);
                    }}
                    onApplyRecommendation={handleApplyRecommendation}
                    onPlanPatch={handlePlanPatch}
                    onComputeDistances={handleComputeDistances}
                    filterState={streamFilterState}
                    onFilterChange={setStreamFilterState}
                    onFixMissingFilter={() => setStreamFilterState((s) => ({ ...s, filter: "missing" }))}
                  />
                  )}
                  {/* Global recommendations (not stream-specific) */}
                  {(wasteStrategy.recommendations ?? []).filter((rec) => {
                    const payload = rec.apply_action?.payload;
                    if (!payload || typeof payload !== "object") return true;
                    const streamName = (payload as { stream_name?: string }).stream_name;
                    return typeof streamName !== "string" || streamName.trim() === "";
                  }).length > 0 && (
                    <div className="mt-10">
                      <h2 className="text-lg font-semibold mb-3">Global recommendations</h2>
                      <ul className="space-y-3">
                        {(wasteStrategy.recommendations ?? [])
                          .filter((rec) => {
                            const payload = rec.apply_action?.payload;
                            if (!payload || typeof payload !== "object") return true;
                            const streamName = (payload as { stream_name?: string }).stream_name;
                            return typeof streamName !== "string" || streamName.trim() === "";
                          })
                          .map((rec, i) => {
                            const resolved = isRecommendationResolved(rec, wasteStrategy.streamPlans ?? []);
                            return (
                              <li
                                key={rec.id ?? i}
                                className={cn(
                                  "rounded-xl border border-border bg-card shadow-sm p-4",
                                  resolved && "opacity-75"
                                )}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <PriorityChip level={rec.priority as PriorityLevel} />
                                  <Badge variant="outline" className="font-normal text-xs">
                                    {String(rec.category).replace(/_/g, " ")}
                                  </Badge>
                                  <span className="font-medium">{rec.title}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">{rec.description}</p>
                                {rec.apply_action && !resolved && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => handleApplyRecommendation(rec.id)}
                                  >
                                    Apply
                                  </Button>
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  )}
                </>
              )}
              </SectionErrorBoundary>
            </section>
          )}

          {/* ---------- NARRATIVE ---------- */}
          {showSection("narrative") && (
            <section id="outputs-narrative" className="print:break-before-auto">
              <h1 className="text-2xl font-semibold mb-2">Narrative</h1>
              <p className="text-sm text-muted-foreground mb-6">
                SWMP summary, methodology, and assumptions.
              </p>
              <SectionErrorBoundary sectionId="narrative">
              {!wasteStrategy?.narrative ? (
                <Card className={CARD_CLASS}>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">
                      {strategySectionLoading && !wasteStrategy
                        ? "Loading…"
                        : strategyError
                          ? strategyError
                          : "Not provided yet. Save inputs and generate the report to see summary and methodology."}
                    </p>
                    {strategyError && projectId && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchWasteStrategy(projectId)}>
                        <RefreshCw className="size-4 mr-2" />
                        Retry
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
              <>
              <Card className={CARD_CLASS}>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Summary</h2>
                    <p className="text-sm text-muted-foreground">
                      {wasteStrategy.narrative.swmp_summary_paragraph}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Facility plan</h2>
                    <p className="text-sm text-muted-foreground">
                      {wasteStrategy.narrative.facility_plan_paragraph}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Methodology</h2>
                    <p className="text-sm text-muted-foreground">
                      {wasteStrategy.narrative.methodology_paragraph}
                    </p>
                  </div>
                  {(wasteStrategy.narrative.key_assumptions?.length ?? 0) > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Key assumptions</h2>
                      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                        {(wasteStrategy.narrative.key_assumptions ?? []).map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(wasteStrategy.narrative.top_recommendations_bullets?.length ?? 0) > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Top recommendations</h2>
                      <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                        {(wasteStrategy.narrative.top_recommendations_bullets ?? []).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {wasteStrategy.narrative.major_drivers_paragraph && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Major drivers</h2>
                      <p className="text-sm text-muted-foreground">
                        {wasteStrategy.narrative.major_drivers_paragraph}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {swmp?.content_html && (
                <Card className={CARD_CLASS}>
                  <CardHeader>
                    <CardTitle className="text-lg">Generated SWMP document</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Full report content (version {swmp.version}).
                    </p>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert swmp-html print:max-w-none"
                      dangerouslySetInnerHTML={{ __html: swmp.content_html }}
                    />
                  </CardContent>
                </Card>
              )}
              </>
              )}
              </SectionErrorBoundary>
            </section>
          )}

          {/* ---------- APPENDIX ---------- */}
          {showSection("appendix") && (
            <section id="outputs-appendix" className="print:break-before-auto">
              <h1 className="text-2xl font-semibold mb-2">Appendix</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Forecast items by stream, unallocated, and conversion required.
              </p>
              <SectionErrorBoundary sectionId="appendix">
              {forecastSectionLoading && forecastItems.length === 0 ? (
                <Card className={CARD_CLASS}>
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">Loading forecast items…</p>
                  </CardContent>
                </Card>
              ) : (
              <div className={SECTION_SPACE}>
                <Card className={CARD_CLASS}>
                  <CardHeader>
                    <CardTitle className="text-lg">Forecast items by stream</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Items contributing to each waste stream total.
                    </p>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    {appendixData.byStream.size === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        No allocated forecast items.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {Array.from(appendixData.byStream.entries())
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([streamKey, items]) => {
                            const totalKg = items.reduce(
                              (sum, i) => sum + (i.computed_waste_kg ?? 0),
                              0
                            );
                            return (
                              <div key={streamKey}>
                                <h3 className="text-base font-semibold mb-2">
                                  {streamKey}{" "}
                                  <span className="text-muted-foreground font-normal">
                                    ({(totalKg / 1000).toFixed(2)} t)
                                  </span>
                                </h3>
                                <div className="overflow-x-auto rounded-md border">
                                  <Table className="table-fixed w-full text-sm">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[40%] px-3 py-3 font-medium">Item</TableHead>
                                        <TableHead className="w-[15%] px-3 py-3 text-right font-medium">Qty</TableHead>
                                        <TableHead className="w-[12%] px-3 py-3 font-medium">Unit</TableHead>
                                        <TableHead className="w-[15%] px-3 py-3 text-right font-medium">Excess %</TableHead>
                                        <TableHead className="w-[18%] px-3 py-3 text-right font-medium">Waste (kg)</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {items.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="px-3 py-4 font-medium align-middle">
                                            {item.item_name || "—"}
                                          </TableCell>
                                          <TableCell className="px-3 py-4 text-right tabular-nums align-middle">
                                            {item.quantity}
                                          </TableCell>
                                          <TableCell className="px-3 py-4 align-middle">
                                            {item.unit}
                                          </TableCell>
                                          <TableCell className="px-3 py-4 text-right tabular-nums align-middle">
                                            {item.excess_percent}%
                                          </TableCell>
                                          <TableCell className="px-3 py-4 text-right tabular-nums align-middle">
                                            {item.computed_waste_kg != null
                                              ? (item.computed_waste_kg ?? 0).toFixed(1)
                                              : "—"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {appendixData.unallocated.length > 0 && (
                  <Card className={CARD_CLASS}>
                    <CardHeader>
                      <CardTitle className="text-lg">Unallocated items</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {appendixData.unallocated.length} item(s) with no waste stream
                        assigned.
                      </p>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                      <div className="overflow-x-auto rounded-md border">
                        <Table className="table-fixed w-full text-sm">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50%] px-3 py-3 font-medium">Item</TableHead>
                              <TableHead className="w-[20%] px-3 py-3 text-right font-medium">Qty</TableHead>
                              <TableHead className="w-[15%] px-3 py-3 font-medium">Unit</TableHead>
                              <TableHead className="w-[15%] px-3 py-3 text-right font-medium">Excess %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {appendixData.unallocated.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="px-3 py-4 font-medium align-middle">
                                  {item.item_name || "—"}
                                </TableCell>
                                <TableCell className="px-3 py-4 text-right tabular-nums align-middle">
                                  {item.quantity}
                                </TableCell>
                                <TableCell className="px-3 py-4 align-middle">{item.unit}</TableCell>
                                <TableCell className="px-3 py-4 text-right tabular-nums align-middle">
                                  {item.excess_percent}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {appendixData.conversionRequired.length > 0 && (
                  <Card className={CARD_CLASS}>
                    <CardHeader>
                      <CardTitle className="text-lg">Conversion required</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {appendixData.conversionRequired.length} item(s) need density or
                        thickness to compute weight.
                      </p>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                      <div className="overflow-x-auto rounded-md border">
                        <Table className="table-fixed w-full text-sm">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[40%] px-3 py-3 font-medium">Item</TableHead>
                              <TableHead className="w-[15%] px-3 py-3 text-right font-medium">Qty</TableHead>
                              <TableHead className="w-[15%] px-3 py-3 font-medium">Unit</TableHead>
                              <TableHead className="w-[15%] px-3 py-3 text-right font-medium">Excess %</TableHead>
                              <TableHead className="w-[15%] px-3 py-3 font-medium">Stream</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {appendixData.conversionRequired.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="px-3 py-4 font-medium align-middle">
                                  {item.item_name || "—"}
                                </TableCell>
                                <TableCell className="px-3 py-4 text-right tabular-nums align-middle">
                                  {item.quantity}
                                </TableCell>
                                <TableCell className="px-3 py-4 align-middle">{item.unit}</TableCell>
                                <TableCell className="px-3 py-4 text-right tabular-nums align-middle">
                                  {item.excess_percent}%
                                </TableCell>
                                <TableCell className="px-3 py-4 align-middle text-muted-foreground">
                                  {item.waste_stream_key ?? "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              )}
              </SectionErrorBoundary>
            </section>
          )}

          {exportMode && (
            <div className="print:hidden flex justify-end">
              <Button onClick={() => window.print()}>Print / PDF</Button>
          </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
