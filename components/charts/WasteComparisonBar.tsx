"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WasteComparisonItem } from "@/lib/wasteChartData";
import { usePrintMode } from "./usePrintMode";

const MANUAL_COLOR = "hsl(221 83% 53%)";
const FORECAST_COLOR = "hsl(142 76% 36%)";
const TOTAL_COLOR = "hsl(262 83% 58%)";

export interface WasteComparisonBarProps {
  data: WasteComparisonItem[];
  /** Optional title override */
  title?: string;
}

export function WasteComparisonBar({ data, title = "Waste Stream Comparison" }: WasteComparisonBarProps) {
  const isPrint = usePrintMode();
  const hasData = data.length > 0;

  return (
    <Card className="overflow-hidden print:break-inside-avoid w-full">
      <CardHeader className="pb-2">
        <h3 className="text-base font-semibold">{title}</h3>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasData ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No waste data to display.</p>
        ) : (
          <div className="waste-chart-bar h-[320px] min-h-[280px] print:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                <XAxis
                  type="number"
                  unit=" t"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => (Number.isFinite(v) ? Number(v).toFixed(1) : "")}
                  className="tabular-nums"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [`${Number(value ?? 0).toFixed(3)} t`, ""]}
                  contentStyle={{ fontSize: "12px" }}
                  wrapperClassName="print:!hidden"
                  labelFormatter={(label) => String(label)}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  dataKey="manual"
                  name="Manual"
                  fill={MANUAL_COLOR}
                  isAnimationActive={!isPrint}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="forecast"
                  name="Forecast"
                  fill={FORECAST_COLOR}
                  isAnimationActive={!isPrint}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="total"
                  name="Total"
                  fill={TOTAL_COLOR}
                  isAnimationActive={!isPrint}
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
