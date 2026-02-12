-- Canonical catalogue: waste stream types (material types) for Forecast and system use.
-- Seed from existing waste stream names; RLS allows authenticated read, super admin write.

CREATE TABLE IF NOT EXISTS public.waste_stream_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waste_stream_types_is_active_sort ON public.waste_stream_types(is_active, sort_order, name);

ALTER TABLE public.waste_stream_types ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active waste stream types only.
CREATE POLICY "Authenticated users can select active waste_stream_types"
  ON public.waste_stream_types FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Super admins full access (for admin management).
CREATE POLICY "Super admins full access waste_stream_types"
  ON public.waste_stream_types
  FOR ALL
  USING (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Seed from canonical waste stream names (idempotent).
INSERT INTO public.waste_stream_types (name, category, sort_order)
VALUES
  ('Mixed C&D', NULL, 0),
  ('Timber (untreated)', NULL, 1),
  ('Timber (treated)', NULL, 2),
  ('Plasterboard / GIB', NULL, 3),
  ('Metals', NULL, 4),
  ('Concrete / masonry', NULL, 5),
  ('Cardboard', NULL, 6),
  ('Soft plastics (wrap/strapping)', NULL, 7),
  ('Hard plastics', NULL, 8),
  ('Glass', NULL, 9),
  ('E-waste (cables/lighting/appliances)', NULL, 10),
  ('Paints/adhesives/chemicals', NULL, 11),
  ('Ceiling tiles', NULL, 12),
  ('Carpet / carpet tiles', NULL, 13),
  ('Insulation', NULL, 14),
  ('Soil / spoil (cleanfill if verified)', NULL, 15),
  ('Asphalt / roading material', NULL, 16),
  ('Concrete (reinforced)', NULL, 17),
  ('Concrete (unreinforced)', NULL, 18),
  ('Masonry / bricks', NULL, 19),
  ('Roofing materials', NULL, 20),
  ('Green waste / vegetation', NULL, 21),
  ('Hazardous waste (general)', NULL, 22),
  ('Contaminated soil', NULL, 23),
  ('Cleanfill soil', NULL, 24),
  ('Packaging (mixed)', NULL, 25),
  ('PVC pipes / services', NULL, 26),
  ('HDPE pipes / services', NULL, 27)
ON CONFLICT (name) DO NOTHING;

-- Add material_type_id to forecast items (keep material_type text for backward compatibility).
ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS material_type_id uuid REFERENCES public.waste_stream_types(id);

COMMENT ON TABLE public.waste_stream_types IS 'Canonical catalogue of waste stream / material types for Forecast and inputs.';
COMMENT ON COLUMN public.project_forecast_items.material_type IS 'Legacy/display: material type name (synced from waste_stream_types when material_type_id set).';
COMMENT ON COLUMN public.project_forecast_items.material_type_id IS 'FK to waste_stream_types; preferred over material_type.';
