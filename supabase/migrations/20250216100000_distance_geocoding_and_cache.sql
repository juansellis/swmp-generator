-- Distance calculation infrastructure: geocoding fields + project_facility_distances cache.
-- Google Maps API is used server-side only; key never exposed to client.

-- Projects: ensure site address and add lat/lng for geocoding
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS site_address text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS site_lat numeric NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS site_lng numeric NULL;

COMMENT ON COLUMN public.projects.site_address IS 'Site address for geocoding and distance matrix (may mirror address).';
COMMENT ON COLUMN public.projects.site_lat IS 'Geocoded latitude from site_address (Google Geocoding API).';
COMMENT ON COLUMN public.projects.site_lng IS 'Geocoded longitude from site_address (Google Geocoding API).';

-- Facilities: address already exists; add lat/lng
ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS lat numeric NULL;

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS lng numeric NULL;

COMMENT ON COLUMN public.facilities.lat IS 'Geocoded latitude from address (Google Geocoding API).';
COMMENT ON COLUMN public.facilities.lng IS 'Geocoded longitude from address (Google Geocoding API).';

-- Cache table: project ↔ facility driving distance and duration
CREATE TABLE IF NOT EXISTS public.project_facility_distances (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  distance_m integer NOT NULL,
  duration_s integer NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, facility_id)
);

CREATE INDEX IF NOT EXISTS idx_project_facility_distances_project_id
  ON public.project_facility_distances(project_id);
CREATE INDEX IF NOT EXISTS idx_project_facility_distances_updated_at
  ON public.project_facility_distances(updated_at);

COMMENT ON TABLE public.project_facility_distances IS 'Cached driving distance/duration from project site to facility (Google Distance Matrix). Writes server-side only.';

ALTER TABLE public.project_facility_distances ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read distances for projects they own
CREATE POLICY "Users can read distances for own projects"
  ON public.project_facility_distances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_facility_distances.project_id AND p.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE for users; server uses service role or bypasses RLS for writes
-- (API routes use createClient() which uses user's JWT; for server writes we need service role or a dedicated policy)
-- Allow service role to manage: typically Next API uses anon/key with RLS. So we need one policy that allows
-- server-side writes. Option: use a policy that allows insert/update/delete only when project is owned.
-- That would let the API (running as the project owner) upsert. So: allow INSERT/UPDATE/DELETE for project owner.
CREATE POLICY "Users can insert distances for own projects"
  ON public.project_facility_distances FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update distances for own projects"
  ON public.project_facility_distances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_facility_distances.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete distances for own projects"
  ON public.project_facility_distances FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_facility_distances.project_id AND p.user_id = auth.uid()
    )
  );
