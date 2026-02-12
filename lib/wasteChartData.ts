/**
 * Chart data for SWMP Outputs analytics.
 * All values in tonnes (manual_qty_tonnes + forecast_qty).
 */

import { planManualQtyToTonnes } from "@/lib/wasteStreamDefaults";

export type PlanForChart = {
  category?: string | null;
  manual_qty_tonnes?: number | null;
  forecast_qty?: number | null;
  estimated_qty?: number | null;
  unit?: string | null;
  density_kg_m3?: number | null;
  thickness_m?: number | null;
  intended_outcomes?: string[] | null;
};

export type SwmpInputsForChart = {
  waste_streams?: unknown[] | null;
  waste_stream_plans?: PlanForChart[] | null;
};

export type WasteDistributionItem = { name: string; value: number };
export type DiversionSummaryItem = { name: "Diverted" | "Landfill"; value: number };
export type WasteComparisonItem = { name: string; manual: number; forecast: number; total: number };

export type WasteChartData = {
  wasteDistribution: WasteDistributionItem[];
  diversionSummary: DiversionSummaryItem[];
  wasteComparison: WasteComparisonItem[];
};

/**
 * Build chart-ready data from latest project inputs.
 * - Excludes streams with total_tonnes = 0.
 * - Diverted = tonnes where intended_outcomes do not include "Landfill"; Landfill = tonnes where they do.
 */
export function buildWasteChartData(inputs: SwmpInputsForChart | null | undefined): WasteChartData {
  const wasteDistribution: WasteDistributionItem[] = [];
  const diversionSummary: DiversionSummaryItem[] = [
    { name: "Diverted", value: 0 },
    { name: "Landfill", value: 0 },
  ];
  const wasteComparison: WasteComparisonItem[] = [];

  if (!inputs?.waste_stream_plans?.length) {
    return { wasteDistribution, diversionSummary, wasteComparison };
  }

  const plans = inputs.waste_stream_plans as PlanForChart[];
  const streamLabelFallback = "Mixed C&D";

  for (const p of plans) {
    const name = (p?.category ?? "").trim() || streamLabelFallback;
    const manualTonnes =
      p?.manual_qty_tonnes != null && Number.isFinite(p.manual_qty_tonnes) && p.manual_qty_tonnes >= 0
        ? p.manual_qty_tonnes
        : (planManualQtyToTonnes(p as Parameters<typeof planManualQtyToTonnes>[0], name) ?? 0);
    const forecastTonnes =
      p?.forecast_qty != null && Number.isFinite(p.forecast_qty) && p.forecast_qty >= 0
        ? p.forecast_qty
        : 0;
    const totalTonnes = manualTonnes + forecastTonnes;

    if (totalTonnes <= 0) continue;

    const outcomes = p?.intended_outcomes ?? [];
    const isLandfill = outcomes.includes("Landfill");
    if (isLandfill) {
      diversionSummary[1].value += totalTonnes;
    } else {
      diversionSummary[0].value += totalTonnes;
    }

    wasteDistribution.push({ name, value: totalTonnes });
    wasteComparison.push({
      name,
      manual: manualTonnes,
      forecast: forecastTonnes,
      total: totalTonnes,
    });
  }

  return {
    wasteDistribution,
    diversionSummary,
    wasteComparison,
  };
}
