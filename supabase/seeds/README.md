# Supabase seeds

Seed data for carbon factor libraries (Jean-Luc’s lists). Run **after** migrations so the tables exist.

## How to run in Supabase

1. **Supabase Dashboard** → your project → **SQL Editor**.
2. Run in this order (so vehicle factors exist before any project entries that reference them):
   - Open `carbon_vehicle_factors_seed.sql`, copy its contents, paste into the editor, run.
   - Open `carbon_resource_factors_seed.sql`, copy its contents, paste into the editor, run.

- **carbon_vehicle_factors_seed.sql** runs `DELETE FROM public.carbon_vehicle_factors` then inserts the full list (safe to re-run). If DELETE fails because of `project_carbon_vehicle_entries`, run `DELETE FROM public.project_carbon_vehicle_entries;` first, then run the vehicle seed again.
- **carbon_resource_factors_seed.sql** only inserts when the table is empty (no duplicates on re-run).

## Re-seeding (replace existing factors)

If the tables already have rows (e.g. from an older seed) and you want to load Jean-Luc’s list from scratch:

1. Delete project-level data that references the factors (otherwise foreign keys block deletes):
   - `DELETE FROM public.project_carbon_vehicle_entries;`
   - `DELETE FROM public.project_carbon_resource_entries;`
2. Clear the factor tables:
   - `DELETE FROM public.carbon_vehicle_factors;`
   - `DELETE FROM public.carbon_resource_factors;`
3. Run the two seed scripts again as above.

After seeding, **Admin → Carbon factors** will show the Machinery & Vehicles and Water, Energy & Fuel lists.
