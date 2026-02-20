-- Carbon Resource Factors seed – Jean-Luc's Water / Energy / Fuel list.
-- Populates public.carbon_resource_factors for Admin → Carbon factors (Water, Energy & Fuel tab).
-- Safe to rerun: only inserts when the table is empty (no duplicates on re-run).
-- To replace existing data: delete project_carbon_resource_entries first, then delete from carbon_resource_factors, then run this script.

INSERT INTO public.carbon_resource_factors (
  category, name, unit, conversion_factor_kgco2e_per_unit, is_active, sort_order
)
SELECT * FROM (VALUES
  ('Water', 'Potable Water (supply)', 'm3', 0.149::numeric, true, 1),
  ('Water', 'Wastewater Treatment', 'm3', 0.567, true, 2),
  ('Energy', 'Electricity (NZ grid)', 'kWh', 0.116, true, 3),
  ('Fuel', 'Fuel Consumption (Diesel)', 'litre', 2.68, true, 4),
  ('Fuel', 'Fuel Consumption (Petrol)', 'litre', 2.31, true, 5),
  ('Fuel', 'Fuel Consumption (LPG)', 'kg', 2.972, true, 6),
  ('Fuel', 'Fuel Consumption (CNG)', 'kg', 2.74, true, 7)
) AS r(category, name, unit, conversion_factor_kgco2e_per_unit, is_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.carbon_resource_factors LIMIT 1);
