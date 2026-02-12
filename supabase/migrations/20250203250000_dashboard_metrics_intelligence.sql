-- Project Intelligence metrics: active projects, primary contractors, facilities linked,
-- total waste streams configured, projects ready for forecasting, updated last 7 days.
-- Used by GET /api/dashboard/metrics.

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_intelligence(p_user_id uuid)
RETURNS TABLE (
  active_projects bigint,
  projects_ready_for_forecasting bigint,
  total_waste_streams_configured bigint,
  facilities_linked bigint,
  primary_contractors_set bigint,
  updated_last_7_days bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_projects AS (
    SELECT id, primary_waste_contractor_partner_id
    FROM projects
    WHERE user_id = p_user_id
  ),
  latest_inputs AS (
    SELECT DISTINCT ON (si.project_id) si.project_id, si.inputs, si.created_at
    FROM swmp_inputs si
    INNER JOIN user_projects up ON up.id = si.project_id
    ORDER BY si.project_id, si.created_at DESC
  )
  SELECT
    -- Active projects (all user projects; no archived flag in schema)
    (SELECT count(*)::bigint FROM user_projects),
    -- Projects ready for forecasting: has inputs, primary contractor set, waste streams exist, all plans have partner_id + facility_id
    (SELECT count(*)::bigint FROM (
      SELECT 1
      FROM latest_inputs li
      INNER JOIN user_projects up ON up.id = li.project_id
      WHERE up.primary_waste_contractor_partner_id IS NOT NULL
        AND jsonb_array_length(li.inputs->'waste_streams') > 0
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(li.inputs->'waste_stream_plans') AS plan_elem
          WHERE coalesce(plan_elem->>'partner_id', '') = ''
             OR coalesce(plan_elem->>'facility_id', '') = ''
        )
    ) x),
    -- Total waste streams configured (sum of waste_streams array lengths from latest inputs)
    (SELECT coalesce(sum(jsonb_array_length(inputs->'waste_streams')), 0)::bigint FROM latest_inputs),
    -- Facilities linked: distinct facility_id from latest inputs' waste_stream_plans
    (SELECT count(*)::bigint FROM (
      SELECT DISTINCT (elem->>'facility_id') AS fid
      FROM latest_inputs li,
      LATERAL jsonb_array_elements(li.inputs->'waste_stream_plans') AS elem
      WHERE elem->>'facility_id' IS NOT NULL AND (elem->>'facility_id') <> ''
    ) f),
    -- Primary contractors set: projects where primary_waste_contractor_partner_id is not null
    (SELECT count(*)::bigint FROM user_projects WHERE primary_waste_contractor_partner_id IS NOT NULL),
    -- Updated last 7 days: projects with swmp_inputs created in last 7 days
    (SELECT count(DISTINCT project_id)::bigint
     FROM swmp_inputs si
     INNER JOIN user_projects up ON up.id = si.project_id
     WHERE si.created_at >= (now() - interval '7 days'));
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics_intelligence(uuid) TO service_role;

COMMENT ON FUNCTION public.get_dashboard_metrics_intelligence(uuid) IS 'Project Intelligence: active_projects, projects_ready_for_forecasting, total_waste_streams_configured, facilities_linked, primary_contractors_set, updated_last_7_days.';
