-- Primary waste contractor: project-level default + optional per-stream override in JSON.
-- Waste streams are stored in swmp_inputs.inputs (JSON); add waste_contractor_partner_id per plan in app model only (no new columns here).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS primary_waste_contractor_partner_id uuid REFERENCES public.partners(id);

COMMENT ON COLUMN public.projects.primary_waste_contractor_partner_id IS 'Default waste contractor (partner) for the project; can be overridden per stream in inputs JSON.';
