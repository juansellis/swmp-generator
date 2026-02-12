"use client";

import * as React from "react";

export type ProjectContextProject = {
  id: string;
  user_id: string;
  name: string;
  site_address?: string | null;
  address: string | null;
  region: string | null;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  client_name: string | null;
  client_logo_url: string | null;
  report_title: string | null;
  report_footer_override: string | null;
  main_contractor: string | null;
  swmp_owner: string | null;
  primary_waste_contractor_partner_id?: string | null;
  [key: string]: unknown;
};

export type ProjectContextValue = {
  projectId: string | null;
  project: ProjectContextProject | null;
  projectLoading: boolean;
  projectError: string | null;
  forecastCount: number;
  setForecastCount: (n: number) => void;
  setProject: (p: ProjectContextProject | null) => void;
};

const ProjectContext = React.createContext<ProjectContextValue | null>(null);

export function useProjectContext(): ProjectContextValue | null {
  return React.useContext(ProjectContext);
}

export { ProjectContext };
