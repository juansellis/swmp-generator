-- Allow all authenticated users to read partners and facilities (for Inputs page catalog dropdowns).
-- Super admins retain full access via existing policies.

CREATE POLICY "Authenticated users can read partners"
  ON public.partners FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read facilities"
  ON public.facilities FOR SELECT
  TO authenticated
  USING (true);

-- Ensure swmp_inputs table exists (project_id + inputs jsonb; no updated_at).
CREATE TABLE IF NOT EXISTS public.swmp_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inputs jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swmp_inputs_project_id ON public.swmp_inputs(project_id);
CREATE INDEX IF NOT EXISTS idx_swmp_inputs_created_at ON public.swmp_inputs(project_id, created_at DESC);

ALTER TABLE public.swmp_inputs ENABLE ROW LEVEL SECURITY;

-- Users can manage swmp_inputs only for their own projects (via projects.user_id).
CREATE POLICY "Users can read own project swmp_inputs"
  ON public.swmp_inputs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = swmp_inputs.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert swmp_inputs for own project"
  ON public.swmp_inputs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project swmp_inputs"
  ON public.swmp_inputs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = swmp_inputs.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project swmp_inputs"
  ON public.swmp_inputs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = swmp_inputs.project_id AND p.user_id = auth.uid()
    )
  );
