"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ProjectContext, useProjectContext, type ProjectContextProject } from "./project-context";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const projectId = (params?.id as string) ?? null;

  const [project, setProject] = React.useState<ProjectContextProject | null>(null);
  const [projectLoading, setProjectLoading] = React.useState(true);
  const [projectError, setProjectError] = React.useState<string | null>(null);
  const [forecastCount, setForecastCount] = React.useState(0);

  React.useEffect(() => {
    if (!projectId) {
      setProjectLoading(false);
      setProjectError("Missing project ID");
      return;
    }

    let mounted = true;

    (async () => {
      setProjectLoading(true);
      setProjectError(null);

      const [projectRes, { count: forecastCountVal }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("project_forecast_items").select("*", { count: "exact", head: true }).eq("project_id", projectId),
      ]);

      if (!mounted) return;

      if (projectRes.error || !projectRes.data) {
        setProjectError(projectRes.error?.message ?? "Project not found");
        setProject(null);
        setProjectLoading(false);
        return;
      }

      setProject(projectRes.data as ProjectContextProject);
      setForecastCount(forecastCountVal ?? 0);
      setProjectLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  const contextValue: React.ContextType<typeof ProjectContext> = React.useMemo(
    () => ({
      projectId,
      project,
      projectLoading,
      projectError,
      forecastCount,
      setForecastCount,
      setProject,
    }),
    [projectId, project, projectLoading, projectError, forecastCount]
  );

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

export { useProjectContext };
