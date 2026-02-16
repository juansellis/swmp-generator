# Fix "Could not find the 'lat' column of 'facilities' in the schema cache"

If you see this error when **creating a new facility**, the `facilities` table is missing the `lat`, `lng`, or `place_id` columns, or PostgREST’s schema cache is out of date.

## Option 1: Supabase Dashboard (quick fix)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor**.
3. **New query** → paste the SQL below → **Run**.

```sql
-- Ensure facilities has lat, lng, place_id for validated addresses
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
```

4. Refresh your app and try **Add facility** again.

## Option 2: Supabase CLI

From the project root:

```bash
npx supabase db push
```

Or, if using a linked remote project:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

This runs all pending migrations, including `20250216300000_facilities_ensure_lat_lng_place_id.sql`.
