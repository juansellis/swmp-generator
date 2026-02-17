-- Feature: Delete project (RLS + policy + optional RPC) and profile optional columns.
-- Does not change schema design: only enables RLS on projects if missing, adds policies, and extends profiles with optional fields.

-- 1) Projects: ensure RLS enabled and policies so only owner or super_admin can delete.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (by name) to avoid duplicates when re-running.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Users can manage own projects') THEN
    DROP POLICY "Users can manage own projects" ON public.projects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Super admins can delete any project') THEN
    DROP POLICY "Super admins can delete any project" ON public.projects;
  END IF;
END $$;

-- Allow select/insert/update for owner (user_id = auth.uid()).
CREATE POLICY "Users can manage own projects"
  ON public.projects
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow delete for super_admin (owner delete is covered by "Users can manage own projects").
CREATE POLICY "Super admins can delete any project"
  ON public.projects
  FOR DELETE
  USING (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- 2) Optional: SQL function for delete (single RPC call; cascade handled by FK).
CREATE OR REPLACE FUNCTION public.delete_project(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_super boolean;
  v_rows int;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_id required');
  END IF;

  SELECT user_id INTO v_user_id FROM public.projects WHERE id = p_project_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Project not found');
  END IF;

  SELECT COALESCE(is_super_admin, false) INTO v_is_super
  FROM public.profiles WHERE id = auth.uid();

  IF v_user_id <> auth.uid() AND v_is_super <> true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized to delete this project');
  END IF;

  DELETE FROM public.projects WHERE id = p_project_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'Delete failed');
END;
$$;

COMMENT ON FUNCTION public.delete_project(uuid) IS 'Deletes a project and its dependent rows (via FK CASCADE). Caller must be project owner or super_admin.';

-- 3) Profile: optional columns for profile page (full_name already exists).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company text;
