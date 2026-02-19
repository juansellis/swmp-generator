"use client";

import React, { useEffect, useState } from "react";
import type { WasteDistributionItem, DiversionSummaryItem } from "@/lib/wasteChartData";
import { WasteDistributionPie } from "@/components/charts/WasteDistributionPie";
import { DiversionOutcomePie } from "@/components/charts/DiversionOutcomePie";

/** Fixed dimensions for export charts (no ResponsiveContainer). */
const EXPORT_W = 520;
const EXPORT_H = 260;

type ChartData = {
  wasteDistribution: WasteDistributionItem[];
  diversionSummary: DiversionSummaryItem[];
};

type Props = {
  chartData: ChartData;
  onReady: () => void;
};

function WasteDistributionTable({ data }: { data: WasteDistributionItem[] }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="mt-4">
      <table className="w-full border-collapse text-sm border border-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2 font-medium border-b border-gray-200">Stream</th>
            <th className="text-right p-2 font-medium border-b border-gray-200">Tonnes</th>
            <th className="text-right p-2 font-medium border-b border-gray-200">%</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name} className="border-b border-gray-100">
              <td className="p-2">{row.name}</td>
              <td className="p-2 text-right tabular-nums">{row.value.toFixed(3)}</td>
              <td className="p-2 text-right tabular-nums">
                {total > 0 ? ((100 * row.value) / total).toFixed(1) : "0"}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiversionSummaryTable({ data }: { data: DiversionSummaryItem[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;
  return (
    <div className="mt-4">
      <table className="w-full border-collapse text-sm border border-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2 font-medium border-b border-gray-200">Outcome</th>
            <th className="text-right p-2 font-medium border-b border-gray-200">Tonnes</th>
            <th className="text-right p-2 font-medium border-b border-gray-200">%</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name} className="border-b border-gray-100">
              <td className="p-2">{row.name}</td>
              <td className="p-2 text-right tabular-nums">{row.value.toFixed(3)}</td>
              <td className="p-2 text-right tabular-nums">
                {((100 * row.value) / total).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExportChartsSection({ chartData, onReady }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => onReady(), 250);
    return () => clearTimeout(t);
  }, [ready, onReady]);

  const { wasteDistribution, diversionSummary } = chartData;
  const hasWasteData = wasteDistribution.length > 0;
  const hasDiversionData = diversionSummary.some((d) => d.value > 0);

  return (
    <>
      <div className="chart-block mt-6">
        <h3 className="report-h3 mb-2">Estimated Waste Distribution</h3>
        <div
          className="chart-frame overflow-visible"
          style={{ width: EXPORT_W, height: EXPORT_H }}
        >
          <WasteDistributionPie data={wasteDistribution} title="" exportMode />
        </div>
        {hasWasteData && <WasteDistributionTable data={wasteDistribution} />}
      </div>
      <div className="chart-block mt-8">
        <h3 className="report-h3 mb-2">Diversion Summary</h3>
        <div
          className="chart-frame overflow-visible"
          style={{ width: EXPORT_W, height: EXPORT_H }}
        >
          <DiversionOutcomePie data={diversionSummary} title="" exportMode />
        </div>
        {hasDiversionData && <DiversionSummaryTable data={diversionSummary} />}
      </div>
    </>
  );
}
