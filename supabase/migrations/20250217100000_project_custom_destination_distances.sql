-- Cached driving distance/duration from project site to custom destinations (by place_id).
-- Writes intended only via server routes (Distance Matrix / geocode); authenticated users can read for own projects.

CREATE TABLE IF NOT EXISTS public.project_custom_destination_distances (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  destination_place_id text NOT NULL,
  destination_name text,
  destination_address text,
  destination_lat numeric,
  destination_lng numeric,
  distance_m integer NOT NULL,
  duration_s integer NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, destination_place_id)
);

COMMENT ON TABLE public.project_custom_destination_distances IS 'Cached driving distance/duration from project site to custom destinations (by place_id). Writes via server routes only.';

CREATE INDEX IF NOT EXISTS idx_project_custom_destination_distances_project_id
  ON public.project_custom_destination_distances(project_id);
CREATE INDEX IF NOT EXISTS idx_project_custom_destination_distances_updated_at
  ON public.project_custom_destination_distances(updated_at);

ALTER TABLE public.project_custom_destination_distances ENABLE ROW LEVEL SECURITY;

-- Authenticated: can read rows for projects they own
CREATE POLICY "Authenticated can read own project custom destination distances"
  ON public.project_custom_destination_distances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_custom_destination_distances.project_id AND p.user_id = auth.uid()
    )
  );

-- Writes only via server routes: allow when project is owned by current user (API runs as user after validation)
CREATE POLICY "Server can insert custom destination distances for own project"
  ON public.project_custom_destination_distances FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Server can update custom destination distances for own project"
  ON public.project_custom_destination_distances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_custom_destination_distances.project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Server can delete custom destination distances for own project"
  ON public.project_custom_destination_distances FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_custom_destination_distances.project_id AND p.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
