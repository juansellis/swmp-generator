-- Waste stream plan destinations and custom address: normalized table for destination_mode, custom_destination_*, and indexing.
-- Distance is computed (e.g. via project_facility_distances or geocoding); no manual distance column here.

CREATE TABLE IF NOT EXISTS public.project_waste_stream_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  facility_id uuid NULL REFERENCES public.facilities(id) ON DELETE SET NULL,
  destination_mode text NOT NULL DEFAULT 'facility' CHECK (destination_mode IN ('facility', 'custom')),
  custom_destination_name text NULL,
  custom_destination_address text NULL,
  custom_destination_place_id text NULL,
  custom_destination_lat numeric NULL,
  custom_destination_lng numeric NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (project_id, category)
);

COMMENT ON TABLE public.project_waste_stream_plans IS 'Per-project, per-stream destination: facility or custom address. Distance is computed elsewhere.';
COMMENT ON COLUMN public.project_waste_stream_plans.destination_mode IS 'facility = use facility_id; custom = use custom_destination_* fields.';
COMMENT ON COLUMN public.project_waste_stream_plans.custom_destination_place_id IS 'Google Place ID for custom destination; used for server re-validation and distance.';

CREATE INDEX IF NOT EXISTS idx_project_waste_stream_plans_project_facility
  ON public.project_waste_stream_plans (project_id, facility_id)
  WHERE facility_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_waste_stream_plans_custom_place_id
  ON public.project_waste_stream_plans (custom_destination_place_id)
  WHERE custom_destination_place_id IS NOT NULL;

ALTER TABLE public.project_waste_stream_plans ENABLE ROW LEVEL SECURITY;

-- Same as swmp_inputs: users can manage only for their own projects
CREATE POLICY "Users can read own project waste stream plans"
  ON public.project_waste_stream_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_waste_stream_plans.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project waste stream plans"
  ON public.project_waste_stream_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project waste stream plans"
  ON public.project_waste_stream_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_waste_stream_plans.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project waste stream plans"
  ON public.project_waste_stream_plans FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_waste_stream_plans.project_id AND p.user_id = auth.uid()
    )
  );

-- Super admins full access
CREATE POLICY "Super admins full access project_waste_stream_plans"
  ON public.project_waste_stream_plans FOR ALL
  USING (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

NOTIFY pgrst, 'reload schema';
