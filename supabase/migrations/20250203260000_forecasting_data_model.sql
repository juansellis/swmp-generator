-- Forecasting feature: project_forecast_items table, updated_at trigger, RLS.
-- Waste stream forecast quantities live in swmp_inputs.inputs JSON (waste_stream_plans[].forecast_qty / forecast_unit);
-- app schema extended in lib/swmp/model.ts for those fields.

-- Table: project_forecast_items
CREATE TABLE IF NOT EXISTS public.project_forecast_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  excess_percent numeric NOT NULL DEFAULT 0,
  material_type text,
  waste_stream_key text,
  computed_waste_qty numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_forecast_items_project_id ON public.project_forecast_items(project_id);

-- Trigger: maintain updated_at on project_forecast_items
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_project_forecast_items_updated_at ON public.project_forecast_items;
CREATE TRIGGER set_project_forecast_items_updated_at
  BEFORE UPDATE ON public.project_forecast_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- RLS: authenticated users can manage forecast items for projects they have access to (project owner)
ALTER TABLE public.project_forecast_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own project forecast items"
  ON public.project_forecast_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_forecast_items.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project forecast items"
  ON public.project_forecast_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project forecast items"
  ON public.project_forecast_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_forecast_items.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_forecast_items.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project forecast items"
  ON public.project_forecast_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_forecast_items.project_id AND p.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.project_forecast_items IS 'Forecast line items per project; computed_waste_qty stores calculated waste from quantity + excess.';
COMMENT ON COLUMN public.project_forecast_items.waste_stream_key IS 'Optional mapping to a waste stream key (e.g. category label from inputs).';
COMMENT ON COLUMN public.project_forecast_items.material_type IS 'Interim select; may be refined later.';
