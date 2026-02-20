-- Seed carbon factor libraries. Names, units and conversion factors are representative (UK-typical).
-- Replace or extend with your exact list; factors are kgCO2e per unit of consumption.
-- Idempotent: only inserts when the respective table is empty.

-- carbon_vehicle_factors: machinery/vehicles (time-based). consumption_unit = per-hour unit; conversion = kgCO2e per that unit.
-- Diesel ~2.68 kgCO2e/L; Petrol ~2.31 kgCO2e/L; Electricity ~0.116 kgCO2e/kWh (UK grid, example).
INSERT INTO public.carbon_vehicle_factors (name, weight_range, fuel_type, avg_consumption_per_hr, consumption_unit, conversion_factor_kgco2e_per_unit, sort_order)
SELECT * FROM (VALUES
  ('Mini Excavator', '1.0–1.5'::text, 'Diesel', 3::numeric, 'L/hr', 2.68::numeric, 10),
  ('Excavator 5–10t', '5–10', 'Diesel', 8, 'L/hr', 2.68, 20),
  ('Excavator 10–20t', '10–20', 'Diesel', 14, 'L/hr', 2.68, 30),
  ('Dumper / Dump Truck', NULL, 'Diesel', 6, 'L/hr', 2.68, 40),
  ('Site Van', NULL, 'Diesel', 2.5, 'L/hr', 2.68, 50),
  ('Site Van', NULL, 'Petrol', 2.5, 'L/hr', 2.31, 51),
  ('Telehandler', NULL, 'Diesel', 5, 'L/hr', 2.68, 60),
  ('Tower Crane', NULL, 'Electric', 25, 'kWh/hr', 0.116, 70),
  ('Mobile Crane', NULL, 'Diesel', 12, 'L/hr', 2.68, 80)
) AS v(name, weight_range, fuel_type, avg_consumption_per_hr, consumption_unit, conversion_factor_kgco2e_per_unit, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.carbon_vehicle_factors LIMIT 1);

-- carbon_resource_factors: water, energy, fuel (quantity-based). unit = per quantity; conversion = kgCO2e per unit.
INSERT INTO public.carbon_resource_factors (category, name, conversion_factor_kgco2e_per_unit, unit, sort_order)
SELECT * FROM (VALUES
  ('Water', 'Potable Water (supply)', 0.149::numeric, 'm3', 10),
  ('Water', 'Potable Water (treatment)', 0.272, 'm3', 11),
  ('Energy', 'Grid electricity (UK)', 0.116, 'kWh', 20),
  ('Energy', 'Grid electricity (UK, marginal)', 0.207, 'kWh', 21),
  ('Fuel', 'Diesel', 2.68, 'litre', 30),
  ('Fuel', 'Petrol', 2.31, 'litre', 31),
  ('Fuel', 'Red diesel', 2.68, 'litre', 32),
  ('Fuel', 'LPG', 1.51, 'kg', 33)
) AS r(category, name, conversion_factor_kgco2e_per_unit, unit, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.carbon_resource_factors LIMIT 1);
