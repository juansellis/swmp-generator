"use client";

import useSWR from "swr";
import { supabase } from "@/lib/supabaseClient";
import { SWR_DEFAULT_OPTIONS } from "@/lib/swr/config";
import type { ProjectContextProject } from "@/app/projects/[id]/project-context";

type ProjectWithForecastCount = {
  project: ProjectContextProject | null;
  forecastCount: number;
};

async function fetcher(projectId: string): Promise<ProjectWithForecastCount> {
  const [projectRes, countRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase
      .from("project_forecast_items")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  if (projectRes.error || !projectRes.data) {
    throw new Error(projectRes.error?.message ?? "Project not found");
  }

  return {
    project: projectRes.data as ProjectContextProject,
    forecastCount: countRes.count ?? 0,
  };
}

export function useProjectWithForecastCount(projectId: string | null) {
  const key = projectId ? ["project", projectId] : null;
  const swr = useSWR(key, ([, id]) => fetcher(id), {
    ...SWR_DEFAULT_OPTIONS,
    keepPreviousData: true,
  });

  const project = swr.data?.project ?? null;
  const forecastCount = swr.data?.forecastCount ?? 0;

  return {
    ...swr,
    project,
    forecastCount,
    setProject: (p: ProjectContextProject | null) =>
      swr.mutate(
        (prev) => (prev ? { ...prev, project: p } : { project: p, forecastCount: 0 }),
        false
      ),
    setForecastCount: (n: number) =>
      swr.mutate(
        (prev) => (prev ? { ...prev, forecastCount: n } : { project: null, forecastCount: n }),
        false
      ),
  };
}
