-- Ensure conversion_factors exists, RLS, and seed from waste_streams so the app is "configured" and the warning disappears.
-- Safe to run: CREATE TABLE IF NOT EXISTS; seed uses ON CONFLICT DO UPDATE.

-- Ensure gen_random_uuid available (built-in in Pg 13+; pgcrypto for older)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create table if not exists (exact schema)
CREATE TABLE IF NOT EXISTS public.conversion_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waste_stream_id uuid NOT NULL REFERENCES public.waste_streams(id) ON DELETE CASCADE,
  from_unit text NOT NULL,
  to_unit text NOT NULL DEFAULT 'kg',
  factor numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (waste_stream_id, from_unit, to_unit)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_conversion_factors_updated_at ON public.conversion_factors;
CREATE TRIGGER trg_conversion_factors_updated_at
  BEFORE UPDATE ON public.conversion_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS (drop any existing policies from prior migrations, then create)
ALTER TABLE public.conversion_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversion_factors_select_auth" ON public.conversion_factors;
DROP POLICY IF EXISTS "conversion_factors_write_super_admin" ON public.conversion_factors;
DROP POLICY IF EXISTS "Super admins full access conversion_factors" ON public.conversion_factors;
DROP POLICY IF EXISTS "Authenticated users can select conversion_factors" ON public.conversion_factors;

CREATE POLICY "conversion_factors_select_auth"
  ON public.conversion_factors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "conversion_factors_write_super_admin"
  ON public.conversion_factors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = true
    )
  );

-- Seed m3 -> kg and m -> kg from waste_streams (idempotent)
INSERT INTO public.conversion_factors (waste_stream_id, from_unit, to_unit, factor, notes)
SELECT ws.id, 'm3', 'kg', ws.default_density_kg_m3, 'Seeded from waste_streams.default_density_kg_m3'
FROM public.waste_streams ws
WHERE ws.is_active = true
  AND ws.default_density_kg_m3 IS NOT NULL
ON CONFLICT (waste_stream_id, from_unit, to_unit)
DO UPDATE SET
  factor = EXCLUDED.factor,
  is_active = true,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO public.conversion_factors (waste_stream_id, from_unit, to_unit, factor, notes)
SELECT ws.id, 'm', 'kg', ws.default_kg_per_m, 'Seeded from waste_streams.default_kg_per_m'
FROM public.waste_streams ws
WHERE ws.is_active = true
  AND ws.default_kg_per_m IS NOT NULL
ON CONFLICT (waste_stream_id, from_unit, to_unit)
DO UPDATE SET
  factor = EXCLUDED.factor,
  is_active = true,
  notes = EXCLUDED.notes,
  updated_at = now();
