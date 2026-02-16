"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StreamPlanItem, StrategyRecommendation, WasteStrategyResult } from "@/lib/planning/wasteStrategyBuilder";
import { DecisionChip } from "@/components/ui/decision-chip";
import { PriorityChip, type PriorityLevel } from "@/components/ui/priority-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { MoreHorizontal, RefreshCw } from "lucide-react";
import { INTENDED_OUTCOME_OPTIONS } from "@/lib/swmp/model";
import { isRecommendationResolved } from "@/app/projects/[id]/swmp/recommendation-helpers";

export type OptimiserStream = {
  stream_name: string;
  total_tonnes: number;
  assigned_facility_id: string | null;
  assigned_facility_name: string | null;
  assigned_distance_km: number | null;
  assigned_duration_min: number | null;
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
  totalHaulageKm: number;
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
          <p className="text-xs font-medium text-muted-foreground">Missing facility</p>
          <p className="text-lg font-semibold tabular-nums">{summary.streamsMissingFacility}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Total haulage (km)</p>
          <p className="text-lg font-semibold tabular-nums">
            {summary.totalHaulageKm > 0 ? summary.totalHaulageKm.toFixed(0) : "—"}
          </p>
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
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Search stream name"
        value={state.search}
        onChange={(e) => onChange({ ...state, search: e.target.value })}
        className="max-w-[200px] h-9"
      />
      <Select
        value={state.filter}
        onValueChange={(v) => onChange({ ...state, filter: v as StreamFilterState["filter"] })}
      >
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All streams</SelectItem>
          <SelectItem value="missing">Missing decisions ({missingCount})</SelectItem>
          <SelectItem value="complete">Complete</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={state.handling}
        onValueChange={(v) => onChange({ ...state, handling: v as StreamFilterState["handling"] })}
      >
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue />
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
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tonnes">Sort: Tonnes (desc)</SelectItem>
          <SelectItem value="missing_first">Sort: Missing first</SelectItem>
          <SelectItem value="distance">Sort: Distance (asc)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
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
    list = list.filter((p) => !p.assigned_facility_id?.trim());
  } else if (filters.filter === "complete") {
    list = list.filter((p) => !!p.assigned_facility_id?.trim());
  }
  if (filters.handling !== "all") {
    list = list.filter((p) => p.handling_mode === filters.handling);
  }
  const optMap = new Map(optimiserStreams.map((s) => [s.stream_name, s]));
  if (filters.sort === "tonnes") {
    list.sort((a, b) => b.total_tonnes - a.total_tonnes);
  } else if (filters.sort === "missing_first") {
    list.sort((a, b) => {
      const aMiss = !a.assigned_facility_id?.trim() ? 1 : 0;
      const bMiss = !b.assigned_facility_id?.trim() ? 1 : 0;
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

export function usePlanningSummary(
  streamPlans: StreamPlanItem[],
  optimiserStreams: OptimiserStream[]
): PlanningSummary {
  return React.useMemo(() => {
    const totalTonnes = streamPlans.reduce((s, p) => s + p.total_tonnes, 0);
    const streamsMissingFacility = streamPlans.filter((p) => !p.assigned_facility_id?.trim()).length;
    let totalHaulageKm = 0;
    const optByStream = new Map(optimiserStreams.map((s) => [s.stream_name, s]));
    for (const p of streamPlans) {
      const o = optByStream.get(p.stream_name);
      if (o?.assigned_distance_km != null && o.assigned_distance_km >= 0) {
        totalHaulageKm += o.assigned_distance_km * (p.total_tonnes || 0);
      }
    }
    return {
      totalTonnes,
      streamsConfigured: streamPlans.filter((p) => p.assigned_facility_id?.trim()).length,
      streamsTotal: streamPlans.length,
      streamsMissingFacility,
      totalHaulageKm,
    };
  }, [streamPlans, optimiserStreams]);
}

export interface StreamPlanningCardProps {
  plan: StreamPlanItem;
  allStreamPlans: StreamPlanItem[];
  optimiserStream: OptimiserStream | null;
  facilityDisplayName: string;
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

export function StreamPlanningCard({
  plan,
  allStreamPlans,
  optimiserStream,
  facilityDisplayName,
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
  const hasFacility = !!(plan.assigned_facility_id?.trim() || (facilityDisplayName && facilityDisplayName !== "—"));
  const nearest = optimiserStream?.nearest ?? [];
  const top3 = nearest.slice(0, 3);
  const [suggestedOpen, setSuggestedOpen] = React.useState(false);
  const [recsOpen, setRecsOpen] = React.useState(false);
  const [handlingUpdating, setHandlingUpdating] = React.useState(false);
  const [outcomeUpdating, setOutcomeUpdating] = React.useState(false);

  const handlingChipState = plan.handling_mode === "separated" ? "separated" : plan.handling_mode === "mixed" ? "mixed" : "missing";
  const cardComplete = hasFacility;
  const maxTonnes = Math.max(plan.total_tonnes, 1);

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

  const outcomeToOptions = (): string[] => {
    if (plan.intended_outcome === "reuse") return ["Reuse"];
    if (plan.intended_outcome === "landfill") return ["Landfill"];
    if (plan.intended_outcome === "recycle") return ["Recycle"];
    return ["Recycle"];
  };

  const handleOutcomeChange = async (outcomes: string[]) => {
    setOutcomeUpdating(true);
    try {
      await onPlanPatch(plan.stream_name, { intended_outcomes: outcomes });
      onRefetch();
    } finally {
      setOutcomeUpdating(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border shadow-sm bg-white dark:bg-card p-5 min-w-0 transition-shadow hover:shadow-md",
        cardComplete ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/10"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="font-semibold text-foreground truncate">{plan.stream_name}</h3>
        <div className="flex items-center gap-2 shrink-0">
          {!hasFacility && (
            <Badge variant="destructive" className="text-xs font-normal bg-red-500/15 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400">
              Missing facility
            </Badge>
          )}
          <DecisionChip state={handlingChipState} />
          <Badge variant="secondary" className="text-xs font-normal tabular-nums">
            {plan.total_tonnes.toFixed(1)} t
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Stream actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  if (hasFacility && onResetFacility) {
                    await onResetFacility(plan.stream_name);
                    onRefetch();
                  }
                }}
                disabled={!hasFacility}
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

      {/* Body: two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Quantities</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Manual (t)</span>
              <span className="tabular-nums">{plan.manual_tonnes.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Forecast (t)</span>
              <span className="tabular-nums">{plan.forecast_tonnes.toFixed(1)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total (t)</span>
              <span className="tabular-nums">{plan.total_tonnes.toFixed(1)}</span>
            </div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 dark:bg-indigo-600"
              style={{ width: `${Math.min(100, (plan.total_tonnes / maxTonnes) * 100)}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Destination</p>
          {hasFacility ? (
            <div className="text-sm">
              <p className="font-medium truncate" title={facilityDisplayName}>
                {facilityDisplayName}
              </p>
              {optimiserStream?.assigned_distance_km != null && (
                <p className="text-muted-foreground text-xs tabular-nums">
                  {optimiserStream.assigned_distance_km} km
                  {optimiserStream.assigned_duration_min != null &&
                    ` · ${Math.round(optimiserStream.assigned_duration_min)} min`}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">No facility selected</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => top3[0] && onApplyFacility(plan.stream_name, top3[0].facility_id)}
                disabled={!top3.length || applyFacilityStream !== null}
              >
                Choose facility
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer: handling, outcome, primary action */}
      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Handling</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => handleHandlingChange("mixed")}
              disabled={handlingUpdating}
              className={cn(
                "px-2.5 py-1 text-xs font-medium",
                plan.handling_mode === "mixed"
                  ? "bg-slate-200 dark:bg-slate-700 text-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              Mixed
            </button>
            <button
              type="button"
              onClick={() => handleHandlingChange("separated")}
              disabled={handlingUpdating}
              className={cn(
                "px-2.5 py-1 text-xs font-medium",
                plan.handling_mode === "separated"
                  ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              Separated
            </button>
          </div>
        </div>
        <Select
          value={outcomeToOptions()[0] ?? "Recycle"}
          onValueChange={(v) => handleOutcomeChange([v])}
          disabled={outcomeUpdating}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            {INTENDED_OUTCOME_OPTIONS.filter((o) => ["Reuse", "Recycle", "Recover", "Landfill"].includes(o)).map(
              (opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          {hasFacility ? (
            <Button variant="outline" size="sm" onClick={() => setSuggestedOpen((o) => !o)}>
              Compare facilities
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!top3.length || applyFacilityStream !== null}
              onClick={() => top3[0] && onApplyFacility(plan.stream_name, top3[0].facility_id)}
            >
              {applyFacilityStream === plan.stream_name ? "Applying…" : "Apply nearest facility"}
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible: Suggested facilities */}
      <details
        className="mt-3 border-t border-border pt-3"
        open={suggestedOpen}
        onToggle={(e) => setSuggestedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground list-none [&::-webkit-details-marker]:hidden">
          Suggested facilities
        </summary>
        <div className="mt-2 space-y-2">
          {distancesCached === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-sm">
              <p className="text-amber-800 dark:text-amber-200 mb-2">Compute distances to see suggestions.</p>
              <Button variant="outline" size="sm" onClick={() => onComputeDistances?.() ?? onRefetch()}>
                <RefreshCw className="size-4 mr-1" />
                Compute distances
              </Button>
            </div>
          ) : top3.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="mb-2">No facilities with cached distances accept this stream.</p>
              {isSuperAdmin && (
                <Link href="/admin/facilities" className="text-primary text-xs font-medium hover:underline">
                  Add facility that accepts this stream
                </Link>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {top3.map((n, i) => (
                <li
                  key={n.facility_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-sm">{n.facility_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {n.distance_km} km · {Math.round(n.duration_min)} min
                      {i === 0 && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">Closest</Badge>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={applyFacilityStream !== null || n.facility_id === plan.assigned_facility_id}
                    onClick={() => onApplyFacility(plan.stream_name, n.facility_id)}
                  >
                    {applyFacilityStream === plan.stream_name ? "Applying…" : "Apply"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {/* Collapsible: Recommendations */}
      {streamRecommendations.length > 0 && (
        <details
          className="mt-3 border-t border-border pt-3"
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
                <li key={rec.id} className="rounded-lg border bg-muted/20 p-2 text-sm">
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
    </div>
  );
}

export interface StreamPlanningCardsProps {
  wasteStrategy: WasteStrategyResult;
  optimiserData: { streams: OptimiserStream[]; distances_cached: number } | null;
  projectId: string;
  isSuperAdmin: boolean;
  applyFacilityStream: string | null;
  getFacilityDisplayName: (plan: StreamPlanItem) => string;
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
  getFacilityDisplayName,
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredPlans.map((plan) => (
          <StreamPlanningCard
            key={plan.stream_id}
            plan={plan}
            allStreamPlans={wasteStrategy.streamPlans}
            optimiserStream={optimiserStreams.find((s) => s.stream_name === plan.stream_name) ?? null}
            facilityDisplayName={getFacilityDisplayName(plan)}
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
    </div>
  );
}
