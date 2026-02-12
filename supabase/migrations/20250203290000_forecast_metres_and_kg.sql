-- Forecast: add metres unit support and weight (kg) for allocation.
-- computed_waste_qty = waste in entered unit (display).
-- computed_waste_kg = waste in kg for allocation; null = non-weight / needs conversion.
-- Allocation totals (forecast_qty) = sum(computed_waste_kg)/1000 per stream (tonnes).

ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS kg_per_m numeric NULL;

ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS computed_waste_kg numeric NULL;

COMMENT ON COLUMN public.project_forecast_items.kg_per_m IS 'When unit = m: kg per metre conversion. Required for metres to contribute to weight totals.';
COMMENT ON COLUMN public.project_forecast_items.computed_waste_kg IS 'Waste quantity in kg for allocation to streams. Null = non-weight unit or missing conversion (excluded from totals).';
