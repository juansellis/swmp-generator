-- Phase 2: Link conversion_factors to waste_streams and seed so all forecast conversions work.
-- Canonical output = kg (then tonnes for reporting). Priority: item override -> stream defaults -> conversion_factors -> conversion_required.

-- 1) conversion_factors: allow rows keyed by waste_stream_id only (waste_stream_type_id becomes optional)
ALTER TABLE public.conversion_factors
  ALTER COLUMN waste_stream_type_id DROP NOT NULL;

-- 2) conversion_factors: add waste_stream_id (FK to waste_streams) and updated_at
ALTER TABLE public.conversion_factors
  ADD COLUMN IF NOT EXISTS waste_stream_id uuid REFERENCES public.waste_streams(id) ON DELETE CASCADE;

ALTER TABLE public.conversion_factors
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger: maintain updated_at on conversion_factors
CREATE OR REPLACE FUNCTION public.set_conversion_factors_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS conversion_factors_updated_at ON public.conversion_factors;
CREATE TRIGGER conversion_factors_updated_at
  BEFORE UPDATE ON public.conversion_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_conversion_factors_updated_at();

COMMENT ON COLUMN public.conversion_factors.waste_stream_id IS 'FK to canonical waste_streams; used for stream-based conversion (tonne/kg/m3/m -> kg).';

-- Partial unique index: one active factor per (waste_stream_id, from_unit, to_unit) when waste_stream_id set
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversion_factors_waste_stream_units
  ON public.conversion_factors (waste_stream_id, from_unit, to_unit)
  WHERE waste_stream_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversion_factors_waste_stream_id
  ON public.conversion_factors(waste_stream_id)
  WHERE waste_stream_id IS NOT NULL;

-- 2) Seed waste_streams: set default_density_kg_m3 where still null (construction-grade defaults by name/key)
UPDATE public.waste_streams
SET default_density_kg_m3 = sub.density
FROM (VALUES
  ('mixed-c-d', 1200),
  ('metals', 63),
  ('cardboard', 38),
  ('hard-plastics', 72),
  ('e-waste-cables-lighting-appliances', 300),
  ('ceiling-tiles', 150),
  ('insulation', 100),
  ('asphalt-roading-material', 1500),
  ('concrete-unreinforced', 900),
  ('roofing-materials', 120),
  ('hazardous-waste-general', 225),
  ('cleanfill-soil', 1500),
  ('pvc-pipes-services', 140),
  ('timber-untreated', 178),
  ('timber-treated', 178),
  ('plasterboard-gib', 238),
  ('concrete-masonry', 1048),
  ('soft-plastics-wrap-strapping', 72),
  ('glass', 411),
  ('paints-adhesives-chemicals', 1000),
  ('carpet-carpet-tiles', 200),
  ('soil-spoil-cleanfill-if-verified', 1500),
  ('concrete-reinforced', 1048),
  ('masonry-bricks', 1500),
  ('green-waste-vegetation', 225),
  ('contaminated-soil', 1500),
  ('packaging-mixed', 38),
  ('hdpe-pipes-services', 100)
) AS sub(key, density)
WHERE public.waste_streams.key = sub.key
  AND public.waste_streams.default_density_kg_m3 IS NULL;

-- 3) Seed conversion_factors per waste_stream: tonne->kg, kg->kg, m3->kg (where density set), m->kg (where kg_per_m set)
INSERT INTO public.conversion_factors (waste_stream_id, from_unit, to_unit, factor, is_active, source, updated_at)
SELECT id, 'tonne', 'kg', 1000, true, 'seed', now() FROM public.waste_streams
UNION ALL
SELECT id, 'kg', 'kg', 1, true, 'seed', now() FROM public.waste_streams
UNION ALL
SELECT id, 'm3', 'kg', default_density_kg_m3, true, 'seed', now() FROM public.waste_streams WHERE default_density_kg_m3 IS NOT NULL
UNION ALL
SELECT id, 'm', 'kg', default_kg_per_m, true, 'seed', now() FROM public.waste_streams WHERE default_kg_per_m IS NOT NULL
ON CONFLICT (waste_stream_id, from_unit, to_unit) WHERE (waste_stream_id IS NOT NULL)
DO UPDATE SET factor = EXCLUDED.factor, is_active = EXCLUDED.is_active, source = EXCLUDED.source, updated_at = now();
