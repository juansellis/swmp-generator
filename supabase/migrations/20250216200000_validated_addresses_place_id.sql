-- Validated Google Maps addresses: place_id + NOT NULL address columns.

-- Projects: add site_place_id; backfill site_address from address; then set NOT NULL
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS site_place_id text;

COMMENT ON COLUMN public.projects.site_place_id IS 'Google Place ID from Places Autocomplete; used for server re-validation.';

UPDATE public.projects
SET site_address = COALESCE(NULLIF(TRIM(site_address), ''), NULLIF(TRIM(address), ''), ' ')
WHERE site_address IS NULL OR TRIM(COALESCE(site_address, '')) = '';

ALTER TABLE public.projects
  ALTER COLUMN site_address SET DEFAULT '';

ALTER TABLE public.projects
  ALTER COLUMN site_address SET NOT NULL;

-- Facilities: add place_id; backfill address; ensure NOT NULL via default
ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS place_id text;

COMMENT ON COLUMN public.facilities.place_id IS 'Google Place ID from Places Autocomplete; used for server re-validation.';

UPDATE public.facilities
SET address = COALESCE(NULLIF(TRIM(address), ''), ' ')
WHERE address IS NULL OR TRIM(address) = '';

ALTER TABLE public.facilities
  ALTER COLUMN address SET DEFAULT '';

ALTER TABLE public.facilities
  ALTER COLUMN address SET NOT NULL;
