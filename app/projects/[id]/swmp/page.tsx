"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SWMP_INPUTS_JSON_COLUMN } from "@/lib/swmp/schema";
import { buildWasteChartData } from "@/lib/wasteChartData";
import type { SwmpInputsForChart } from "@/lib/wasteChartData";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ProjectHeader } from "@/components/project-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { WasteDistributionPie } from "@/components/charts/WasteDistributionPie";
import { DiversionOutcomePie } from "@/components/charts/DiversionOutcomePie";
import { WasteComparisonBar } from "@/components/charts/WasteComparisonBar";

type SwmpRow = {
  id: string;
  version: number;
  content_html: string | null;
  created_at: string;
};

export default function SwmpPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swmp, setSwmp] = useState<SwmpRow | null>(null);
  const [chartInputs, setChartInputs] = useState<SwmpInputsForChart | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      setChartInputs(null);

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
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router, projectId]);

  const chartData = useMemo(
    () => buildWasteChartData(chartInputs),
    [chartInputs]
  );

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
        <div className="space-y-6">
          <ProjectHeader />
          <PageHeader title="Generated SWMP" />
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-10">
        <div className="print:hidden space-y-2">
          <ProjectHeader />
          <PageHeader
            title="SWMP Outputs"
            subtitle={
              <span className="text-sm text-muted-foreground">
                Version {swmp?.version} • Generated{" "}
                {swmp ? new Date(swmp.created_at).toLocaleString() : ""}
              </span>
            }
          />
        </div>

        <div data-export className="space-y-6">
          {/* Analytics charts: tonnes only, read-only, print-friendly */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Waste analytics charts">
            <WasteDistributionPie data={chartData.wasteDistribution} />
            <DiversionOutcomePie data={chartData.diversionSummary} />
            <div className="lg:col-span-2">
              <WasteComparisonBar data={chartData.wasteComparison} />
            </div>
          </section>

          <Card
            id="swmp-output"
            className="overflow-hidden rounded-2xl border shadow-sm print:shadow-none print:border print:bg-white"
          >
            <CardContent className="p-6 print:p-0">
              <div
                className="prose prose-sm max-w-none dark:prose-invert swmp-html print:max-w-none"
                dangerouslySetInnerHTML={{ __html: swmp?.content_html ?? "<p>No HTML saved.</p>" }}
              />
            </CardContent>
          </Card>
          <div className="flex justify-end print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted/80"
            >
              Export (Print / PDF)
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
