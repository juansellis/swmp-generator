-- Ensure project_forecast_items has computed_waste_kg with DEFAULT 0 for safe inserts.
-- computed_waste_qty = display in entered unit; computed_waste_kg = canonical for conversions/allocations.

-- Add column if missing (e.g. 20250203290000 not applied)
ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS kg_per_m numeric NULL;

ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS computed_waste_kg numeric DEFAULT 0;

-- If column already existed without default (from earlier migration), set default now
ALTER TABLE public.project_forecast_items
  ALTER COLUMN computed_waste_kg SET DEFAULT 0;

-- Reload PostgREST schema cache so API sees the new column
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.project_forecast_items.kg_per_m IS 'When unit = m: kg per metre conversion. Required for metres to contribute to weight totals.';
COMMENT ON COLUMN public.project_forecast_items.computed_waste_kg IS 'Waste in kg for allocation (canonical). Default 0. Null = non-weight / needs conversion (excluded from stream totals).';
