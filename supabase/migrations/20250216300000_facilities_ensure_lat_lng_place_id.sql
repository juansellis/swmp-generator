-- Ensure facilities has lat, lng, place_id for validated addresses (fixes schema cache error if earlier migrations were skipped).
ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS place_id text;
ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS lat numeric NULL;
ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS lng numeric NULL;

COMMENT ON COLUMN public.facilities.place_id IS 'Google Place ID from Places Autocomplete; used for server re-validation.';
COMMENT ON COLUMN public.facilities.lat IS 'Geocoded latitude from address (Google Geocoding API).';
COMMENT ON COLUMN public.facilities.lng IS 'Geocoded longitude from address (Google Geocoding API).';

-- Reload PostgREST schema cache so the API sees the new columns
NOTIFY pgrst, 'reload schema';
