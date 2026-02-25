"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StreamPlanItem, StrategyRecommendation, WasteStrategyResult } from "@/lib/planning/wasteStrategyBuilder";
import { PriorityChip, type PriorityLevel } from "@/components/ui/priority-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { MoreHorizontal, Pencil, Sparkles } from "lucide-react";
import { INTENDED_OUTCOME_OPTIONS } from "@/lib/swmp/model";
import { isRecommendationResolved } from "@/app/projects/[id]/swmp/recommendation-helpers";

export type OptimiserStreamRecommendedFacility = {
  facility_id: string;
  facility_name: string;
  distance_km: number | null;
  duration_min: number | null;
  distance_not_computed: boolean;
};

export type OptimiserStream = {
  stream_name: string;
  total_tonnes: number;
  assigned_facility_id: string | null;
  assigned_facility_name: string | null;
  /** Strict: facility name, or custom name/address, or null. Never recommendation/partner as selected. */
  assigned_destination_display?: string | null;
  assigned_distance_km: number | null;
  assigned_duration_min: number | null;
  /** Partner-based recommended facility (for "Recommended: X (km)" + Apply when destination not set). */
  recommended_facility?: OptimiserStreamRecommendedFacility | null;
  nearest: {
    facility_id: string;
    facility_name: string;
    partner_name: string;
    distance_km: number;
    duration_min: number;
  }[];
};

export type PlanningSummary = {
  totalTonnes: number;
  streamsConfigured: number;
  streamsTotal: number;
  streamsMissingFacility: number;
  /** Mean distance (km) across plans that have a destination with distance; null if none. */
  averageDistanceKm: number | null;
  /** Count of plans used in the average (destinations with distance). */
  destinationCountWithDistance: number;
};

export function PlanningSummaryBar({
  summary,
  onFixMissing,
  showFixMissing = true,
}: {
  summary: PlanningSummary;
  onFixMissing?: () => void;
  showFixMissing?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white dark:bg-card shadow-sm p-4 flex flex-wrap items-center gap-4 md:gap-6">
      <div className="flex flex-wrap items-center gap-4 md:gap-6 min-w-0">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Total estimated tonnes</p>
          <p className="text-lg font-semibold tabular-nums">{summary.totalTonnes.toFixed(1)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Streams configured</p>
          <p className="text-lg font-semibold tabular-nums">
            {summary.streamsConfigured}/{summary.streamsTotal}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">No destination</p>
          <p className="text-lg font-semibold tabular-nums">{summary.streamsMissingFacility}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Average facility distance (km)</p>
          <p className="text-lg font-semibold tabular-nums">
            {summary.averageDistanceKm != null ? summary.averageDistanceKm.toFixed(1) : "—"}
          </p>
          {summary.destinationCountWithDistance > 0 ? (
            <p className="text-[10px] text-muted-foreground">Across {summary.destinationCountWithDistance} configured destination{summary.destinationCountWithDistance !== 1 ? "s" : ""}</p>
          ) : (
            <p className="text-[10px] text-muted-foreground">Set destinations to compute distance</p>
          )}
        </div>
      </div>
      {showFixMissing && summary.streamsMissingFacility > 0 && onFixMissing && (
        <Button size="sm" onClick={onFixMissing} className="shrink-0">
          Fix missing facilities
        </Button>
      )}
    </div>
  );
}

export type StreamFilterState = {
  search: string;
  filter: "all" | "missing" | "complete";
  handling: "all" | "mixed" | "separated";
  sort: "tonnes" | "missing_first" | "distance";
};

export function StreamPlanningFilters({
  state,
  onChange,
  missingCount,
}: {
  state: StreamFilterState;
  onChange: (next: StreamFilterState) => void;
  missingCount: number;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <Input
        placeholder="Search stream name"
        value={state.search}
        onChange={(e) => onChange({ ...state, search: e.target.value })}
        className="h-9 w-full min-w-0 sm:max-w-[200px]"
      />
      <Select
        value={state.filter}
        onValueChange={(v) => onChange({ ...state, filter: v as StreamFilterState["filter"] })}
      >
        <SelectTrigger className="h-9 w-full sm:w-[160px]">
          <SelectValue placeholder="Stream" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All streams</SelectItem>
          <SelectItem value="missing">Missing ({missingCount})</SelectItem>
          <SelectItem value="complete">Complete</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={state.handling}
        onValueChange={(v) => onChange({ ...state, handling: v as StreamFilterState["handling"] })}
      >
        <SelectTrigger className="h-9 w-full sm:w-[130px]">
          <SelectValue placeholder="Handling" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Handling: All</SelectItem>
          <SelectItem value="mixed">Mixed</SelectItem>
          <SelectItem value="separated">Separated</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={state.sort}
        onValueChange={(v) => onChange({ ...state, sort: v as StreamFilterState["sort"] })}
      >
        <SelectTrigger className="h-9 w-full sm:w-[160px]">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tonnes">Tonnes (desc)</SelectItem>
          <SelectItem value="missing_first">Missing first</SelectItem>
          <SelectItem value="distance">Distance (asc)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** True if stream has a destination set (facility or custom). */
function hasDestinationSet(plan: StreamPlanItem): boolean {
  if (plan.assigned_facility_id?.trim()) return true;
  if (plan.destination_mode === "custom") {
    const name = (plan.custom_destination_name ?? "").trim();
    const addr = (plan.custom_destination_address ?? "").trim();
    if (name || addr) return true;
  }
  return false;
}

function filterAndSortPlans(
  plans: StreamPlanItem[],
  optimiserStreams: OptimiserStream[],
  filters: StreamFilterState
): StreamPlanItem[] {
  let list = [...plans];
  const search = filters.search.trim().toLowerCase();
  if (search) {
    list = list.filter((p) => p.stream_name.toLowerCase().includes(search));
  }
  if (filters.filter === "missing") {
    list = list.filter((p) => !hasDestinationSet(p));
  } else if (filters.filter === "complete") {
    list = list.filter((p) => hasDestinationSet(p));
  }
  if (filters.handling !== "all") {
    list = list.filter((p) => p.handling_mode === filters.handling);
  }
  const optMap = new Map(optimiserStreams.map((s) => [s.stream_name, s]));
  if (filters.sort === "tonnes") {
    list.sort((a, b) => b.total_tonnes - a.total_tonnes);
  } else if (filters.sort === "missing_first") {
    list.sort((a, b) => {
      const aMiss = !hasDestinationSet(a) ? 1 : 0;
      const bMiss = !hasDestinationSet(b) ? 1 : 0;
      if (bMiss !== aMiss) return bMiss - aMiss;
      return b.total_tonnes - a.total_tonnes;
    });
  } else if (filters.sort === "distance") {
    list.sort((a, b) => {
      const oa = optMap.get(a.stream_name);
      const ob = optMap.get(b.stream_name);
      const da = oa?.assigned_distance_km ?? 9999;
      const db = ob?.assigned_distance_km ?? 9999;
      return da - db;
    });
  }
  return list;
}

export function getRecommendationsForStream(
  recommendations: StrategyRecommendation[],
  streamName: string
): StrategyRecommendation[] {
  return recommendations.filter((rec) => {
    const payload = rec.apply_action?.payload;
    if (!payload || typeof payload !== "object") return false;
    const name = (payload as { stream_name?: string }).stream_name;
    return typeof name === "string" && name.trim() === streamName.trim();
  });
}

/** Canonical per-plan distance (km): plan.distance_km first, then optimiser assigned_distance_km. */
function getPlanDistanceKm(plan: StreamPlanItem, optimiserStream: OptimiserStream | null): number | null {
  if (!hasDestinationSet(plan)) return null;
  const fromPlan = plan.distance_km != null && Number.isFinite(plan.distance_km) && plan.distance_km >= 0 ? plan.distance_km : null;
  if (fromPlan != null) return fromPlan;
  const km = optimiserStream?.assigned_distance_km;
  if (km != null && Number.isFinite(km) && km >= 0) return km;
  return null;
}

export function usePlanningSummary(
  streamPlans: StreamPlanItem[],
  optimiserStreams: OptimiserStream[]
): PlanningSummary {
  return React.useMemo(() => {
    const totalTonnes = streamPlans.reduce((s, p) => s + p.total_tonnes, 0);
    const streamsMissingFacility = streamPlans.filter((p) => !hasDestinationSet(p)).length;
    const optByStream = new Map(optimiserStreams.map((s) => [s.stream_name, s]));
    const distances: number[] = [];
    for (const p of streamPlans) {
      const d = getPlanDistanceKm(p, optByStream.get(p.stream_name) ?? null);
      if (d != null) distances.push(d);
    }
    const destinationCountWithDistance = distances.length;
    const averageDistanceKm =
      destinationCountWithDistance > 0
        ? distances.reduce((a, b) => a + b, 0) / destinationCountWithDistance
        : null;
    return {
      totalTonnes,
      streamsConfigured: streamPlans.filter((p) => hasDestinationSet(p)).length,
      streamsTotal: streamPlans.length,
      streamsMissingFacility,
      averageDistanceKm,
      destinationCountWithDistance,
    };
  }, [streamPlans, optimiserStreams]);
}

export interface StreamPlanningCardProps {
  plan: StreamPlanItem;
  allStreamPlans: StreamPlanItem[];
  optimiserStream: OptimiserStream | null;
  /** Strict destination label only (facility name, custom, or "No destination selected."). Never recommendation/partner. */
  destinationDisplayName: string;
  streamRecommendations: StrategyRecommendation[];
  projectId: string;
  distancesCached: number;
  isSuperAdmin: boolean;
  applyFacilityStream: string | null;
  onApplyFacility: (streamName: string, facilityId: string) => Promise<void>;
  onResetFacility?: (streamName: string) => Promise<void>;
  onRefetch: () => void;
  onApplyRecommendation: (recId: string) => Promise<void>;
  onPlanPatch: (streamName: string, patch: { handling_mode?: "mixed" | "separated"; intended_outcomes?: string[] }) => Promise<void>;
  onComputeDistances?: () => void;
}

function StreamNameWithTooltip({ name }: { name: string }) {
  const truncated = name.length > 28;
  const content = (
    <span className="block truncate font-semibold text-foreground" title={truncated ? name : undefined}>
      {name}
    </span>
  );
  if (truncated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px]">
          {name}
        </TooltipContent>
      </Tooltip>
    );
  }
  return content;
}

export function StreamPlanningCard({
  plan,
  allStreamPlans,
  optimiserStream,
  destinationDisplayName,
  streamRecommendations,
  projectId,
  distancesCached,
  isSuperAdmin,
  applyFacilityStream,
  onApplyFacility,
  onResetFacility,
  onRefetch,
  onApplyRecommendation,
  onPlanPatch,
  onComputeDistances,
}: StreamPlanningCardProps) {
  const hasDestination = destinationDisplayName !== "No destination selected.";
  const nearest = optimiserStream?.nearest ?? [];
  const top3 = nearest.slice(0, 3);
  const recommendedFacility = optimiserStream?.recommended_facility ?? null;
  const hasPartner = !!(plan.partner_id?.trim());
  const [recsOpen, setRecsOpen] = React.useState(false);
  const [handlingUpdating, setHandlingUpdating] = React.useState(false);
  const [outcomeUpdating, setOutcomeUpdating] = React.useState(false);

  const displayOutcome = plan.intended_outcome_display ?? "Recycle";
  const distanceKm = (plan.distance_km != null && Number.isFinite(plan.distance_km)) ? plan.distance_km : (optimiserStream?.assigned_distance_km ?? null);
  const durationMin = plan.duration_min ?? optimiserStream?.assigned_duration_min ?? null;
  const customAddress = plan.destination_mode === "custom" && (plan.custom_destination_address ?? "").trim();

  const handleHandlingChange = async (mode: "mixed" | "separated") => {
    if (mode === plan.handling_mode) return;
    setHandlingUpdating(true);
    try {
      await onPlanPatch(plan.stream_name, { handling_mode: mode });
      onRefetch();
    } finally {
      setHandlingUpdating(false);
    }
  };

  const handleOutcomeChange = async (value: string) => {
    setOutcomeUpdating(true);
    try {
      await onPlanPatch(plan.stream_name, { intended_outcomes: [value] });
      onRefetch();
    } finally {
      setOutcomeUpdating(false);
    }
  };

  return (
    <Card
      className={cn(
        "flex flex-col border-border/40 bg-card p-4 shadow-sm transition-[box-shadow,transform] hover:shadow-md hover:-translate-y-0.5 min-w-0 gap-0"
      )}
    >
      <CardContent className="p-0 flex flex-col flex-1 gap-4">
        {/* Header row: stream name | status + overflow */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <StreamNameWithTooltip name={plan.stream_name} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasDestination ? (
              <Badge variant="secondary" className="text-xs font-medium bg-emerald-500/15 text-emerald-700 border-0 dark:bg-emerald-950/50 dark:text-emerald-400">
                Configured
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs font-medium bg-amber-500/15 text-amber-700 border-0 dark:bg-amber-950/50 dark:text-amber-400">
                Needs attention
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Stream actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async () => {
                    if (hasDestination && onResetFacility) {
                      await onResetFacility(plan.stream_name);
                      onRefetch();
                    }
                  }}
                  disabled={!hasDestination}
                >
                  Reset facility
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/projects/${projectId}/forecast?stream=${encodeURIComponent(plan.stream_name)}`}>
                    View forecast items
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meta row: tonnes, handling, disposal, destination state */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-foreground">{plan.total_tonnes.toFixed(1)} t</span>
          <Badge variant="outline" className="text-xs font-normal">
            {plan.handling_mode === "separated" ? "Separated" : plan.handling_mode === "mixed" ? "Mixed" : "—"}
          </Badge>
          <Badge variant="outline" className="text-xs font-normal">
            {displayOutcome}
          </Badge>
          {hasDestination ? (
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-muted-foreground/30">
              Set
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-destructive/30">
              Not set
            </Badge>
          )}
        </div>

        {/* Destination block */}
        <div className="space-y-1">
          {hasDestination ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm font-medium truncate">{destinationDisplayName}</p>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px]">
                      {destinationDisplayName}
                    </TooltipContent>
                  </Tooltip>
                  {customAddress ? (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{customAddress}</p>
                  ) : null}
                </div>
                <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {distanceKm != null ? (
                    <>
                      {distanceKm.toFixed(1)} km{durationMin != null ? ` · ${Math.round(durationMin)} min` : ""}
                    </>
                  ) : (
                    "Distance pending"
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">No destination</p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs font-medium"
                asChild
              >
                <Link href={`/projects/${projectId}/optimiser`}>Set destination</Link>
              </Button>
            </div>
          )}
          {!hasDestination && hasPartner && recommendedFacility && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 mt-1">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Recommended: {recommendedFacility.facility_name}</p>
                <p className="text-xs text-muted-foreground">
                  {recommendedFacility.distance_not_computed ? "Distance pending" : `${recommendedFacility.distance_km} km`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => onApplyFacility(plan.stream_name, recommendedFacility.facility_id)}
                disabled={applyFacilityStream !== null}
              >
                Apply
              </Button>
            </div>
          )}
          {!hasDestination && !hasPartner && (
            <p className="text-xs text-muted-foreground">Select a partner to see recommendations.</p>
          )}
          {!hasDestination && hasPartner && !recommendedFacility && (
            <p className="text-xs text-muted-foreground">No matching facilities for this stream.</p>
          )}
        </div>

        {/* Quantities: muted inset panel */}
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Manual</p>
              <p className="text-sm font-medium tabular-nums">{plan.manual_tonnes.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Forecast</p>
              <p className="text-sm font-medium tabular-nums">{plan.forecast_tonnes.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-sm font-semibold tabular-nums">{plan.total_tonnes.toFixed(1)}</p>
            </div>
          </div>
        </div>

        {/* Controls: handling toggle + disposal select (compact) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => handleHandlingChange("mixed")}
              disabled={handlingUpdating}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors",
                plan.handling_mode === "mixed"
                  ? "bg-muted text-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted/50"
              )}
            >
              Mixed
            </button>
            <button
              type="button"
              onClick={() => handleHandlingChange("separated")}
              disabled={handlingUpdating}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors",
                plan.handling_mode === "separated"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30"
                  : "bg-transparent text-muted-foreground hover:bg-muted/50"
              )}
            >
              Separated
            </button>
          </div>
          <Select value={displayOutcome} onValueChange={handleOutcomeChange} disabled={outcomeUpdating}>
            <SelectTrigger className="h-8 w-[130px] text-xs border-border/60">
              <SelectValue placeholder="Disposal" />
            </SelectTrigger>
            <SelectContent>
              {INTENDED_OUTCOME_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bottom action row: Optimise + Edit; Apply nearest when no destination */}
        <div className="flex flex-wrap items-center gap-2 pt-2 mt-auto border-t border-border/50">
          {!hasDestination && top3.length > 0 && (
            <Button
              size="sm"
              variant="default"
              className="h-8"
              disabled={applyFacilityStream !== null}
              onClick={() => top3[0] && onApplyFacility(plan.stream_name, top3[0].facility_id)}
            >
              {applyFacilityStream === plan.stream_name ? "Applying…" : "Apply nearest"}
            </Button>
          )}
          <Button variant="secondary" size="sm" className="h-8 gap-1.5" asChild>
            <Link href={`/projects/${projectId}/optimiser`}>
              <Sparkles className="size-3.5" />
              Optimise facilities
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" asChild>
            <Link href={`/projects/${projectId}/forecast?stream=${encodeURIComponent(plan.stream_name)}`}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>
        </div>

        {/* Collapsible: Recommendations */}
        {streamRecommendations.length > 0 && (
          <details
            className="border-t border-border/50 pt-3 mt-0"
            open={recsOpen}
            onToggle={(e) => setRecsOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground list-none [&::-webkit-details-marker]:hidden">
              Recommendations ({streamRecommendations.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {streamRecommendations.map((rec) => {
                const resolved = isRecommendationResolved(rec, allStreamPlans);
                return (
                  <li key={rec.id} className="rounded-md border border-border/50 bg-muted/20 p-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityChip level={rec.priority as PriorityLevel} />
                      <span className="font-medium">{rec.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{rec.description}</p>
                    {rec.apply_action && !resolved && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={() => onApplyRecommendation(rec.id)}
                      >
                        Apply
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export interface StreamPlanningCardsProps {
  wasteStrategy: WasteStrategyResult;
  optimiserData: { streams: OptimiserStream[]; distances_cached: number } | null;
  projectId: string;
  isSuperAdmin: boolean;
  applyFacilityStream: string | null;
  getDestinationDisplay: (plan: StreamPlanItem, optimiserStream?: OptimiserStream | null) => string;
  onApplyFacility: (streamName: string, facilityId: string) => Promise<void>;
  onResetFacility?: (streamName: string) => Promise<void>;
  onRefetch: () => void;
  onApplyRecommendation: (recId: string) => Promise<void>;
  onPlanPatch: (streamName: string, patch: { handling_mode?: "mixed" | "separated"; intended_outcomes?: string[] }) => Promise<void>;
  onComputeDistances: () => void;
  filterState: StreamFilterState;
  onFilterChange: (state: StreamFilterState) => void;
  onFixMissingFilter: () => void;
}

export function StreamPlanningCards({
  wasteStrategy,
  optimiserData,
  projectId,
  isSuperAdmin,
  applyFacilityStream,
  getDestinationDisplay,
  onApplyFacility,
  onResetFacility,
  onRefetch,
  onApplyRecommendation,
  onPlanPatch,
  onComputeDistances,
  filterState,
  onFilterChange,
  onFixMissingFilter,
}: StreamPlanningCardsProps) {
  const optimiserStreams = optimiserData?.streams ?? [];
  const summary = usePlanningSummary(wasteStrategy.streamPlans, optimiserStreams);
  const filteredPlans = filterAndSortPlans(
    wasteStrategy.streamPlans,
    optimiserStreams,
    filterState
  );

  return (
    <div className="space-y-6">
      <PlanningSummaryBar
        summary={summary}
        onFixMissing={onFixMissingFilter}
        showFixMissing={summary.streamsMissingFacility > 0}
      />
      <StreamPlanningFilters
        state={filterState}
        onChange={onFilterChange}
        missingCount={summary.streamsMissingFacility}
      />
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => (
            <StreamPlanningCard
            key={plan.stream_id}
            plan={plan}
            allStreamPlans={wasteStrategy.streamPlans}
            optimiserStream={optimiserStreams.find((s) => s.stream_name === plan.stream_name) ?? null}
            destinationDisplayName={getDestinationDisplay(plan, optimiserStreams.find((s) => s.stream_name === plan.stream_name) ?? null)}
            streamRecommendations={getRecommendationsForStream(wasteStrategy.recommendations, plan.stream_name)}
            projectId={projectId}
            distancesCached={optimiserData?.distances_cached ?? 0}
            isSuperAdmin={isSuperAdmin}
            applyFacilityStream={applyFacilityStream}
            onApplyFacility={onApplyFacility}
            onResetFacility={onResetFacility}
            onRefetch={onRefetch}
            onApplyRecommendation={onApplyRecommendation}
            onPlanPatch={onPlanPatch}
            onComputeDistances={onComputeDistances}
          />
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
