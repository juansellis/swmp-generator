-- Add conversion-default columns to canonical waste_stream_types so Materials admin
-- and conversion logic use one source. Then point conversion_factors at waste_stream_types.

-- 1) waste_stream_types: add key (stable id), default_density_kg_m3, default_kg_per_m, default_unit, notes
ALTER TABLE public.waste_stream_types
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS default_density_kg_m3 numeric,
  ADD COLUMN IF NOT EXISTS default_kg_per_m numeric,
  ADD COLUMN IF NOT EXISTS default_unit text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill key: stable unique id (slug from name where safe, else id-based)
UPDATE public.waste_stream_types
SET key = 'wst-' || substr(replace(id::text, '-', ''), 1, 12)
WHERE key IS NULL OR key = '';

-- Enforce unique not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_waste_stream_types_key ON public.waste_stream_types(key);
ALTER TABLE public.waste_stream_types ALTER COLUMN key SET NOT NULL;

-- 2) conversion_factors: add waste_stream_type_id, backfill from material_types by name, then drop material_type_id
ALTER TABLE public.conversion_factors
  ADD COLUMN IF NOT EXISTS waste_stream_type_id uuid REFERENCES public.waste_stream_types(id) ON DELETE CASCADE;

UPDATE public.conversion_factors cf
SET waste_stream_type_id = wst.id
FROM public.material_types mt
JOIN public.waste_stream_types wst ON wst.name = mt.name
WHERE cf.material_type_id = mt.id AND cf.waste_stream_type_id IS NULL;

-- Remove rows that could not be matched (no waste_stream_types.name = material_types.name)
DELETE FROM public.conversion_factors WHERE waste_stream_type_id IS NULL AND material_type_id IS NOT NULL;

ALTER TABLE public.conversion_factors DROP CONSTRAINT IF EXISTS conversion_factors_material_type_id_fkey;
DROP INDEX IF EXISTS idx_conversion_factors_material;
ALTER TABLE public.conversion_factors DROP COLUMN IF EXISTS material_type_id;

-- Make waste_stream_type_id required for new rows
ALTER TABLE public.conversion_factors ALTER COLUMN waste_stream_type_id SET NOT NULL;

-- Recreate unique index for active (waste_stream_type_id)
DROP INDEX IF EXISTS idx_conversion_factors_active_unique;
CREATE UNIQUE INDEX idx_conversion_factors_active_unique
  ON public.conversion_factors (waste_stream_type_id, from_unit, to_unit)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_conversion_factors_waste_stream_type
  ON public.conversion_factors(waste_stream_type_id);

COMMENT ON COLUMN public.waste_stream_types.key IS 'Stable slug for API/config; must match stream_key where used.';
COMMENT ON COLUMN public.waste_stream_types.default_density_kg_m3 IS 'Default density (kg/m³) for m³→kg conversion.';
COMMENT ON COLUMN public.waste_stream_types.default_kg_per_m IS 'Default kg per metre for linear (m) units.';
