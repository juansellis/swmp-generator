-- Dashboard metrics: single RPC for lightweight counts (scoped to user).
-- Used by GET /api/dashboard-metrics.

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_user_id uuid)
RETURNS TABLE (
  active_projects bigint,
  total_waste_streams bigint,
  facilities_linked bigint,
  projects_ready_for_forecasting bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Active projects
    (SELECT count(*)::bigint FROM projects WHERE user_id = p_user_id),
    -- Total waste streams: from latest swmp_inputs per project, sum waste_streams array lengths
    (SELECT coalesce(sum(cnt), 0)::bigint FROM (
      SELECT jsonb_array_length(inputs->'waste_streams') AS cnt
      FROM (
        SELECT DISTINCT ON (si.project_id) si.inputs
        FROM swmp_inputs si
        INNER JOIN projects p ON p.id = si.project_id AND p.user_id = p_user_id
        ORDER BY si.project_id, si.created_at DESC
      ) latest
    ) x),
    -- Facilities linked: distinct facility_id from latest inputs' waste_stream_plans
    (SELECT count(*)::bigint FROM (
      SELECT DISTINCT (elem->>'facility_id') AS fid
      FROM (
        SELECT DISTINCT ON (si.project_id) si.inputs
        FROM swmp_inputs si
        INNER JOIN projects p ON p.id = si.project_id AND p.user_id = p_user_id
        ORDER BY si.project_id, si.created_at DESC
      ) latest,
      LATERAL jsonb_array_elements(latest.inputs->'waste_stream_plans') AS elem
      WHERE elem->>'facility_id' IS NOT NULL AND (elem->>'facility_id') <> ''
    ) f),
    -- Projects ready for forecasting: have at least one swmp_inputs (inputs saved)
    (SELECT count(DISTINCT si.project_id)::bigint
     FROM swmp_inputs si
     INNER JOIN projects p ON p.id = si.project_id AND p.user_id = p_user_id);
$$;

-- Service role (used by API with supabaseAdmin) must be able to execute.
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid) TO service_role;

COMMENT ON FUNCTION public.get_dashboard_metrics(uuid) IS 'Returns dashboard counts for a user: active_projects, total_waste_streams, facilities_linked, projects_ready_for_forecasting.';
