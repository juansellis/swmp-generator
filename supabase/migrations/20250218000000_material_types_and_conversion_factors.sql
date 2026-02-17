-- Materials and conversion factors for Forecast and unit conversion (admin-managed).
-- RLS: authenticated read; super-admin insert/update. No destructive deletes (use is_active).

CREATE TABLE IF NOT EXISTS public.material_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text,
  default_density_kg_m3 numeric,
  default_kg_per_m numeric,
  default_unit text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_types_is_active_sort
  ON public.material_types(is_active, sort_order, name);

COMMENT ON TABLE public.material_types IS 'Admin-managed materials for Forecast dropdown and conversion defaults (density, kg/m).';

ALTER TABLE public.material_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select material_types"
  ON public.material_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins full access material_types"
  ON public.material_types FOR ALL
  USING ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- Conversion factors: per-material unit -> kg (or other to_unit).
CREATE TABLE IF NOT EXISTS public.conversion_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type_id uuid NOT NULL REFERENCES public.material_types(id) ON DELETE CASCADE,
  from_unit text NOT NULL,
  to_unit text NOT NULL DEFAULT 'kg',
  factor numeric NOT NULL,
  assumption text,
  source text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversion_factors_active_unique
  ON public.conversion_factors (material_type_id, from_unit, to_unit)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_conversion_factors_material
  ON public.conversion_factors(material_type_id);

COMMENT ON TABLE public.conversion_factors IS 'Per-material unit conversion factors (e.g. m -> kg, m3 -> kg). One active row per (material, from_unit, to_unit).';

ALTER TABLE public.conversion_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select conversion_factors"
  ON public.conversion_factors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins full access conversion_factors"
  ON public.conversion_factors FOR ALL
  USING ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- Optional: link forecast items to material_types for conversion defaults (keep existing material_type_id for waste_stream_types).
ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.material_types(id);

COMMENT ON COLUMN public.project_forecast_items.material_id IS 'Optional FK to material_types for conversion defaults (density, kg_per_m).';
