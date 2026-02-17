-- Run this in Supabase SQL Editor to confirm the projects.primary_waste_contractor_partner_id column exists.
-- If the query returns one row with column_name = 'primary_waste_contractor_partner_id' and data_type = 'uuid', the column is present.

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
  AND column_name = 'primary_waste_contractor_partner_id';

-- If the above returns no rows, add the column (migration 20250203230000_primary_waste_contractor.sql should have added it):
-- ALTER TABLE public.projects
--   ADD COLUMN IF NOT EXISTS primary_waste_contractor_partner_id uuid REFERENCES public.partners(id);
-- COMMENT ON COLUMN public.projects.primary_waste_contractor_partner_id IS 'Default waste contractor (partner) for the project; can be overridden per stream in inputs JSON.';
