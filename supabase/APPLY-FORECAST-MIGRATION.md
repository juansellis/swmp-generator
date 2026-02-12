# Apply forecast migration (fix "computed_waste_kg column not found")

If you see: **Could not find the 'computed_waste_kg' column of 'project_forecast_items' in the schema cache**, run the migration below on your Supabase database.

## Option 1: Supabase Dashboard (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor**.
3. Click **New query**, paste the SQL below, then **Run**.

```sql
-- Ensure project_forecast_items has computed_waste_kg with DEFAULT 0 (safe inserts).
ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS kg_per_m numeric NULL;

ALTER TABLE public.project_forecast_items
  ADD COLUMN IF NOT EXISTS computed_waste_kg numeric DEFAULT 0;

ALTER TABLE public.project_forecast_items
  ALTER COLUMN computed_waste_kg SET DEFAULT 0;

-- Reload PostgREST schema cache so the API sees the new column
NOTIFY pgrst, 'reload schema';

COMMENT ON COLUMN public.project_forecast_items.kg_per_m IS 'When unit = m: kg per metre conversion. Required for metres to contribute to weight totals.';
COMMENT ON COLUMN public.project_forecast_items.computed_waste_kg IS 'Waste in kg for allocation (canonical). Default 0. Null = non-weight / needs conversion (excluded from stream totals).';
```

4. Refresh your app and try **Add forecast item** again.

## Option 2: Supabase CLI (for future migrations)

From the project root:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Project ref is in Dashboard → Project Settings → General (e.g. `tqrzqbdtjafofhplpzox`).
