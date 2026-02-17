"use client";

import * as React from "react";

/** Explicit project columns for fetch so primary_waste_contractor_partner_id and address fields always load (no missing columns when navigating). */
export const PROJECT_SELECT_FIELDS =
  "id, user_id, name, site_address, site_place_id, site_lat, site_lng, address, region, project_type, start_date, end_date, client_name, client_logo_url, report_title, report_footer_override, main_contractor, swmp_owner, primary_waste_contractor_partner_id, created_at";

export type ProjectContextProject = {
  id: string;
  user_id: string;
  name: string;
  site_address?: string | null;
  site_place_id?: string | null;
  site_lat?: number | null;
  site_lng?: number | null;
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
