-- Add optional profile columns for /profile page (full_name already exists from 20250203000001).
-- Idempotent: safe to run multiple times. No RLS change (existing UPDATE policy applies to all columns).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company text;

COMMENT ON COLUMN public.profiles.phone IS 'Optional phone (profile page).';
COMMENT ON COLUMN public.profiles.role_title IS 'Optional role/title (profile page).';
COMMENT ON COLUMN public.profiles.company IS 'Optional company (profile page).';
