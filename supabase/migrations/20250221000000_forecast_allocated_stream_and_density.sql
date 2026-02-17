-- Phase 3: Forecast overhaul — allocated_stream_id (canonical), row density override, remove material_id.

-- 1) Add allocated_stream_id (FK to waste_streams) and density_kg_m3 (row override for m3→kg)
ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS allocated_stream_id uuid REFERENCES public.waste_streams(id) ON DELETE SET NULL;

ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS density_kg_m3 numeric;

COMMENT ON COLUMN public.project_forecast_items.allocated_stream_id IS 'Canonical FK to waste_streams; required for allocation. Replaces waste_stream_key as source of truth.';
COMMENT ON COLUMN public.project_forecast_items.density_kg_m3 IS 'Row override for m3→kg when unit is m3 (kg/m³). Overrides stream default.';

-- 2) Backfill allocated_stream_id from waste_stream_key (match waste_streams.name)
UPDATE public.project_forecast_items p
SET allocated_stream_id = ws.id
FROM public.waste_streams ws
WHERE p.allocated_stream_id IS NULL
  AND p.waste_stream_key IS NOT NULL
  AND trim(p.waste_stream_key) = ws.name;

-- 3) Remove material_id if present (Phase 3: remove leftover material references)
ALTER TABLE public.project_forecast_items DROP COLUMN IF EXISTS material_id;

CREATE INDEX IF NOT EXISTS idx_project_forecast_items_allocated_stream
  ON public.project_forecast_items(allocated_stream_id)
  WHERE allocated_stream_id IS NOT NULL;
