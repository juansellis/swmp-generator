-- Carbon Forecast module: machinery/vehicles (time-based) and water/energy/fuel (quantity-based).
-- Admin-managed factor libraries + per-project entries. No changes to existing tables.

-- 1) carbon_vehicle_factors (admin-managed library)
CREATE TABLE IF NOT EXISTS public.carbon_vehicle_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  weight_range text,
  fuel_type text NOT NULL,
  avg_consumption_per_hr numeric NOT NULL,
  consumption_unit text NOT NULL,
  conversion_factor_kgco2e_per_unit numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carbon_vehicle_factors_active_sort
  ON public.carbon_vehicle_factors(is_active, sort_order);

COMMENT ON TABLE public.carbon_vehicle_factors IS 'Admin-managed library: machinery/vehicles with time-based consumption. Emissions = time_active_hours * avg_consumption_per_hr * conversion_factor_kgco2e_per_unit.';
COMMENT ON COLUMN public.carbon_vehicle_factors.conversion_factor_kgco2e_per_unit IS 'kgCO2e per unit of consumption (e.g. per L or per kWh).';

ALTER TABLE public.carbon_vehicle_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select carbon_vehicle_factors"
  ON public.carbon_vehicle_factors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins full access carbon_vehicle_factors"
  ON public.carbon_vehicle_factors FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
  );

-- 2) carbon_resource_factors (admin-managed library)
CREATE TABLE IF NOT EXISTS public.carbon_resource_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  conversion_factor_kgco2e_per_unit numeric NOT NULL,
  unit text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carbon_resource_factors_active_sort
  ON public.carbon_resource_factors(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_carbon_resource_factors_category
  ON public.carbon_resource_factors(category);

COMMENT ON TABLE public.carbon_resource_factors IS 'Admin-managed library: water, energy, fuel with quantity-based emissions. Emissions = quantity_used * conversion_factor_kgco2e_per_unit.';

ALTER TABLE public.carbon_resource_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select carbon_resource_factors"
  ON public.carbon_resource_factors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins full access carbon_resource_factors"
  ON public.carbon_resource_factors FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
  );

-- 3) project_carbon_vehicle_entries (project data)
CREATE TABLE IF NOT EXISTS public.project_carbon_vehicle_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  factor_id uuid NOT NULL REFERENCES public.carbon_vehicle_factors(id) ON DELETE RESTRICT,
  time_active_hours numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_carbon_vehicle_entries_project_id
  ON public.project_carbon_vehicle_entries(project_id);

COMMENT ON TABLE public.project_carbon_vehicle_entries IS 'Per-project machinery/vehicle usage. emissions_kgco2e = time_active_hours * factor.avg_consumption_per_hr * factor.conversion_factor_kgco2e_per_unit (calculated).';

ALTER TABLE public.project_carbon_vehicle_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own project carbon vehicle entries"
  ON public.project_carbon_vehicle_entries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_carbon_vehicle_entries.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own project carbon vehicle entries"
  ON public.project_carbon_vehicle_entries FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Users can update own project carbon vehicle entries"
  ON public.project_carbon_vehicle_entries FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_carbon_vehicle_entries.project_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_carbon_vehicle_entries.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own project carbon vehicle entries"
  ON public.project_carbon_vehicle_entries FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_carbon_vehicle_entries.project_id AND p.user_id = auth.uid())
  );

-- 4) project_carbon_resource_entries (project data)
CREATE TABLE IF NOT EXISTS public.project_carbon_resource_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  factor_id uuid NOT NULL REFERENCES public.carbon_resource_factors(id) ON DELETE RESTRICT,
  quantity_used numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_carbon_resource_entries_project_id
  ON public.project_carbon_resource_entries(project_id);

COMMENT ON TABLE public.project_carbon_resource_entries IS 'Per-project water/energy/fuel usage. emissions_kgco2e = quantity_used * factor.conversion_factor_kgco2e_per_unit (calculated).';

ALTER TABLE public.project_carbon_resource_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own project carbon resource entries"
  ON public.project_carbon_resource_entries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_carbon_resource_entries.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own project carbon resource entries"
  ON public.project_carbon_resource_entries FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Users can update own project carbon resource entries"
  ON public.project_carbon_resource_entries FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_carbon_resource_entries.project_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_carbon_resource_entries.project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own project carbon resource entries"
  ON public.project_carbon_resource_entries FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_carbon_resource_entries.project_id AND p.user_id = auth.uid())
  );

-- updated_at trigger for factor tables (reuse existing function if present)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_carbon_vehicle_factors_updated_at ON public.carbon_vehicle_factors;
CREATE TRIGGER trg_carbon_vehicle_factors_updated_at
  BEFORE UPDATE ON public.carbon_vehicle_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_carbon_resource_factors_updated_at ON public.carbon_resource_factors;
CREATE TRIGGER trg_carbon_resource_factors_updated_at
  BEFORE UPDATE ON public.carbon_resource_factors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
