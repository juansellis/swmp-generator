"use client";

import * as React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DiversionSummaryItem } from "@/lib/wasteChartData";
import { usePrintMode } from "./usePrintMode";

const EXPORT_CHART_WIDTH = 520;
const EXPORT_CHART_HEIGHT = 260;

const DIVERTED_COLOR = "hsl(142 76% 36%)"; // green
const LANDFILL_COLOR = "hsl(0 84% 60%)";   // red

export interface DiversionOutcomePieProps {
  data: DiversionSummaryItem[];
  /** Optional title override */
  title?: string;
  /** When true, render fixed-size chart without ResponsiveContainer (for PDF export) */
  exportMode?: boolean;
}

export function DiversionOutcomePie({ data, title = "Diversion Summary", exportMode = false }: DiversionOutcomePieProps) {
  const isPrint = usePrintMode();
  const hasData = data.some((d) => d.value > 0);
  const noAnimation = exportMode || isPrint;

  if (exportMode) {
    return (
      <div style={{ width: EXPORT_CHART_WIDTH, height: EXPORT_CHART_HEIGHT }} className="overflow-visible">
        {!hasData ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No diversion data to display.</p>
        ) : (
          <PieChart width={EXPORT_CHART_WIDTH} height={EXPORT_CHART_HEIGHT} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius={0}
              outerRadius="75%"
              paddingAngle={1}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.name === "Landfill" ? LANDFILL_COLOR : DIVERTED_COLOR}
                />
              ))}
            </Pie>
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: "12px" }}
            />
          </PieChart>
        )}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden print:break-inside-avoid">
      <CardHeader className="pb-2">
        <h3 className="text-base font-semibold">{title}</h3>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasData ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No diversion data to display.</p>
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
                  isAnimationActive={!noAnimation}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.name === "Landfill" ? LANDFILL_COLOR : DIVERTED_COLOR}
                    />
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
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
