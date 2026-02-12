-- Forecast → Inputs linkage (documentation only; no schema change).
-- Waste streams live in swmp_inputs.inputs JSON:
--   - waste_streams: array of stream names (category keys)
--   - waste_stream_plans: array of plans; each has:
--       estimated_qty  = manual entry (editable on Inputs)
--       forecast_qty   = SUM(computed_waste_qty) of forecast items allocated to this stream (set by sync)
--       total_qty      = estimated_qty + forecast_qty (computed in UI only)
-- Forecast items (project_forecast_items) allocate via waste_stream_key (text) matching plan.category.
-- Recompute: on forecast insert/update/delete, forecast_qty per stream is recomputed as sum (no incremental update).

COMMENT ON COLUMN public.project_forecast_items.waste_stream_key IS 'Allocates this item to an Inputs waste stream (matches swmp_inputs.inputs waste_stream_plans[].category). Forecast qty per stream = SUM(computed_waste_qty) of items with this key.';
