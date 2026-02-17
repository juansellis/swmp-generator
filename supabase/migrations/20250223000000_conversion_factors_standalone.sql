-- Standalone conversion_factors table for DBs where it never existed or to reset to canonical schema.
-- Columns: id, waste_stream_id, from_unit, to_unit, factor, is_active, notes, created_at, updated_at.
-- Priority: item override -> waste_streams.default_* -> conversion_factors -> conversion_required.

DROP TABLE IF EXISTS public.conversion_factors CASCADE;

CREATE TABLE public.conversion_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waste_stream_id uuid NOT NULL REFERENCES public.waste_streams(id) ON DELETE CASCADE,
  from_unit text NOT NULL,
  to_unit text NOT NULL DEFAULT 'kg',
  factor numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_conversion_factors_waste_stream_units
  ON public.conversion_factors (waste_stream_id, from_unit, to_unit);

CREATE INDEX idx_conversion_factors_waste_stream_id
  ON public.conversion_factors(waste_stream_id);

COMMENT ON TABLE public.conversion_factors IS 'Per waste stream unit conversion factors (e.g. m3/m -> kg). Used after waste_streams.default_density_kg_m3 / default_kg_per_m.';

CREATE OR REPLACE FUNCTION public.set_conversion_factors_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversion_factors_updated_at ON public.conversion_factors;
CREATE TRIGGER conversion_factors_updated_at
  BEFORE UPDATE ON public.conversion_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_conversion_factors_updated_at();

ALTER TABLE public.conversion_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select conversion_factors"
  ON public.conversion_factors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins full access conversion_factors"
  ON public.conversion_factors FOR ALL
  USING ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true)
  WITH CHECK ((SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true);
