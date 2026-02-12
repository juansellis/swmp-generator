"use client";

import * as React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WasteDistributionItem } from "@/lib/wasteChartData";
import { usePrintMode } from "./usePrintMode";

function chartColor(index: number): string {
  const fallbacks = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];
  return fallbacks[index % fallbacks.length];
}

export interface WasteDistributionPieProps {
  data: WasteDistributionItem[];
  /** Optional title override */
  title?: string;
}

export function WasteDistributionPie({ data, title = "Estimated Waste Distribution" }: WasteDistributionPieProps) {
  const isPrint = usePrintMode();
  const hasData = data.length > 0;

  return (
    <Card className="overflow-hidden print:break-inside-avoid">
      <CardHeader className="pb-2">
        <h3 className="text-base font-semibold">{title}</h3>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasData ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No waste data to display.</p>
        ) : (
          <div className="waste-chart-pie h-[280px] print:h-[260px] [&_.recharts-legend-wrapper]:!bottom-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={0}
                  outerRadius="75%"
                  paddingAngle={1}
                  isAnimationActive={!isPrint}
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={chartColor(index)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined) => [`${Number(value ?? 0).toFixed(3)} t`, "Tonnes"]}
                  contentStyle={{ fontSize: "12px" }}
                  wrapperClassName="print:!hidden"
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: "12px" }}
                  formatter={(value) => value}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
