-- Per-stream handling_mode in swmp_inputs.inputs JSON (no table change).
-- waste_stream_plans[].handling_mode: 'mixed' | 'separated'
--   - mixed = co-mingled
--   - separated = source-separated onsite
-- Default when missing: 'mixed'. Set via Inputs UI and shown in Outputs.
-- (If project_waste_streams table existed we would add: handling_mode text NOT NULL DEFAULT 'mixed' CHECK (handling_mode IN ('mixed','separated')))

COMMENT ON COLUMN public.swmp_inputs.inputs IS 'JSON: sorting_level, target_diversion, waste_streams, waste_stream_plans (each plan may include handling_mode: mixed|separated), etc.';
