-- Add full_name to profiles (optional display name).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

-- Super admins can read all profiles (for admin Users page).
CREATE POLICY "Super admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    (SELECT is_super_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
  );

-- Super admins can update any profile (toggle is_super_admin, edit full_name).
CREATE POLICY "Super admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    (SELECT is_super_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT is_super_admin FROM public.profiles p WHERE p.id = auth.uid()) = true
  );
