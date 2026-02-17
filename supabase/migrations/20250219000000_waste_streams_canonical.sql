-- Canonical waste streams table (replaces reliance on waste_stream_types for stream list).
-- Seed from hardcoded STREAM_DEFAULTS; keys are stable slugs; name is display (and used in accepted_streams / waste_stream_key).
-- RLS: authenticated read active; super-admin full write.

CREATE TABLE IF NOT EXISTS public.waste_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text,
  default_unit text NOT NULL DEFAULT 'tonne',
  default_density_kg_m3 numeric,
  default_kg_per_m numeric,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waste_streams_is_active_sort
  ON public.waste_streams(is_active, sort_order, name);

COMMENT ON TABLE public.waste_streams IS 'Canonical list of waste streams for Inputs, Facilities accepted streams, Forecast allocation, Strategy. Do not break key/name used in existing data.';

ALTER TABLE public.waste_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select active waste_streams"
  ON public.waste_streams FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Super admins full access waste_streams"
  ON public.waste_streams FOR ALL
  USING ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);

CREATE OR REPLACE FUNCTION public.set_waste_streams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS waste_streams_updated_at ON public.waste_streams;
CREATE TRIGGER waste_streams_updated_at
  BEFORE UPDATE ON public.waste_streams
  FOR EACH ROW EXECUTE FUNCTION public.set_waste_streams_updated_at();

-- Seed: keys = slug(name), names and defaults match STREAM_DEFAULTS / WASTE_STREAM_LIBRARY (do not change keys).
INSERT INTO public.waste_streams (key, name, category, default_unit, default_density_kg_m3, default_kg_per_m, sort_order)
VALUES
  ('mixed-c-d', 'Mixed C&D', NULL, 'm3', 1200, NULL, 0),
  ('timber-treated', 'Timber (treated)', NULL, 'm3', 178, NULL, 1),
  ('metals', 'Metals', NULL, 'm3', 63, NULL, 2),
  ('cardboard', 'Cardboard', NULL, 'm3', 38, NULL, 3),
  ('hard-plastics', 'Hard plastics', NULL, 'm3', 72, NULL, 4),
  ('e-waste-cables-lighting-appliances', 'E-waste (cables/lighting/appliances)', NULL, 'm3', 300, NULL, 5),
  ('ceiling-tiles', 'Ceiling tiles', NULL, 'm2', 150, NULL, 6),
  ('insulation', 'Insulation', NULL, 'm3', 100, NULL, 7),
  ('asphalt-roading-material', 'Asphalt / roading material', NULL, 'm3', 1500, NULL, 8),
  ('concrete-unreinforced', 'Concrete (unreinforced)', NULL, 'm3', 900, NULL, 9),
  ('roofing-materials', 'Roofing materials', NULL, 'm2', 120, NULL, 10),
  ('hazardous-waste-general', 'Hazardous waste (general)', NULL, 'm3', 225, NULL, 11),
  ('cleanfill-soil', 'Cleanfill soil', NULL, 'm3', 1500, NULL, 12),
  ('pvc-pipes-services', 'PVC pipes / services', NULL, 'm3', 140, NULL, 13),
  ('timber-untreated', 'Timber (untreated)', NULL, 'm3', 178, NULL, 14),
  ('plasterboard-gib', 'Plasterboard / GIB', NULL, 'm3', 238, NULL, 15),
  ('concrete-masonry', 'Concrete / masonry', NULL, 'm3', 1048, NULL, 16),
  ('soft-plastics-wrap-strapping', 'Soft plastics (wrap/strapping)', NULL, 'm3', 72, NULL, 17),
  ('glass', 'Glass', NULL, 'm3', 411, NULL, 18),
  ('paints-adhesives-chemicals', 'Paints/adhesives/chemicals', NULL, 'L', 1000, NULL, 19),
  ('carpet-carpet-tiles', 'Carpet / carpet tiles', NULL, 'm2', 200, NULL, 20),
  ('soil-spoil-cleanfill-if-verified', 'Soil / spoil (cleanfill if verified)', NULL, 'm3', 1500, NULL, 21),
  ('concrete-reinforced', 'Concrete (reinforced)', NULL, 'm3', 1048, NULL, 22),
  ('masonry-bricks', 'Masonry / bricks', NULL, 'm3', 1500, NULL, 23),
  ('green-waste-vegetation', 'Green waste / vegetation', NULL, 'm3', 225, NULL, 24),
  ('contaminated-soil', 'Contaminated soil', NULL, 'm3', 1500, NULL, 25),
  ('packaging-mixed', 'Packaging (mixed)', NULL, 'm3', 38, NULL, 26),
  ('hdpe-pipes-services', 'HDPE pipes / services', NULL, 'm3', 100, NULL, 27)
ON CONFLICT (key) DO NOTHING;
