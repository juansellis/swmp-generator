-- Carbon Vehicle Factors seed – Jean-Luc's Machinery & Vehicles list.
-- Populates public.carbon_vehicle_factors for Admin → Carbon factors (Machinery & Vehicles tab).
-- Safe to re-run: deletes all rows then re-inserts the full list.
-- Note: DELETE will fail if any project_carbon_vehicle_entries reference these factors (FK).
-- Clear project_carbon_vehicle_entries first if needed, then run this script.

DELETE FROM public.carbon_vehicle_factors;

INSERT INTO public.carbon_vehicle_factors (
  name, weight_range, fuel_type, avg_consumption_per_hr, consumption_unit, conversion_factor_kgco2e_per_unit, is_active, sort_order
)
SELECT * FROM (VALUES
  ('Micro Excavator', '<1.0', 'Diesel', 2::numeric, 'L/hr', 5.4::numeric, true, 1),
  ('Mini Excavator', '1.0–1.5', 'Diesel', 3, 'L/hr', 8, true, 2),
  ('Mini Excavator', '1.5–2.5', 'Diesel', 4, 'L/hr', 10.7, true, 3),
  ('Mini Excavator', '2.6–3.5', 'Diesel', 5, 'L/hr', 13.4, true, 4),
  ('Compact Excavator', '3.6–5.0', 'Diesel', 7, 'L/hr', 18.8, true, 5),
  ('Mid-Size Excavator', '5.1–8.0', 'Diesel', 10, 'L/hr', 26.8, true, 6),
  ('Medium Excavator', '8.1–13.0', 'Diesel', 15, 'L/hr', 40.2, true, 7),
  ('Large Excavator', '13.1–20.0', 'Diesel', 22, 'L/hr', 59, true, 8),
  ('Heavy Excavator', '20.1–30.0', 'Diesel', 30, 'L/hr', 80.4, true, 9),
  ('Heavy Excavator', '30.0+', 'Diesel', 40, 'L/hr', 107.2, true, 10),
  ('Mini Loader (Kanga/Dingo)', '0.8–1.2', 'Petrol', 2.5, 'L/hr', 5.8, true, 11),
  ('Mini Loader (Kanga/Dingo)', '0.8–1.2', 'Diesel', 2.5, 'L/hr', 6.7, true, 12),
  ('Skid Steer Loader', '2.0–3.0', 'Petrol', 3.5, 'L/hr', 8.1, true, 13),
  ('Skid Steer Loader', '2.0–4.0', 'Diesel', 6, 'L/hr', 16.1, true, 14),
  ('Skid Steer Loader', '2.0–3.0', 'Electric', 6, 'kWh/hr', 0.61, true, 15),
  ('Compact Track Loader', '3.5–5.0', 'Diesel', 9, 'L/hr', 24.1, true, 16),
  ('Wheel Loader', '5.0–8.0', 'Diesel', 12, 'L/hr', 32.2, true, 17),
  ('Wheel Loader', '10.0–15.0', 'Diesel', 18, 'L/hr', 48.2, true, 18),
  ('Wheel Loader', '20.0–30.0', 'Diesel', 30, 'L/hr', 80.4, true, 19),
  ('Plate Compactor', '≤65 kg', 'Petrol', 0.9, 'L/hr', 2.1, true, 20),
  ('Plate Compactor', '65–100 kg', 'Petrol', 1.2, 'L/hr', 2.8, true, 21),
  ('Plate Compactor', '100–200 kg', 'Diesel', 1.8, 'L/hr', 4.8, true, 22),
  ('Trench Rammer', '70–100 kg', 'Petrol', 1.3, 'L/hr', 3, true, 23),
  ('Pedestrian Roller', '0.5–1.5 t', 'Diesel', 4, 'L/hr', 10.7, true, 24),
  ('Ride-On Roller', '2–5 t', 'Diesel', 7, 'L/hr', 18.8, true, 25),
  ('Ride-On Roller', '5–10 t', 'Diesel', 12, 'L/hr', 32.2, true, 26),
  ('Waterblaster', '≤2000 PSI', 'Electric', 3, 'kWh/hr', 0.3, true, 27),
  ('Waterblaster', '≤2000 PSI', 'Petrol', 1.2, 'L/hr', 2.8, true, 28),
  ('Waterblaster', '2000–3000 PSI', 'Electric', 4, 'kWh/hr', 0.4, true, 29),
  ('Waterblaster', '2000–3000 PSI', 'Petrol', 1.8, 'L/hr', 4.2, true, 30),
  ('Industrial Waterblaster', '3000+ PSI', 'Diesel', 4, 'L/hr', 10.7, true, 31),
  ('Backhoe Loader', '7–9 t', 'Diesel', 8, 'L/hr', 21.4, true, 32),
  ('Site Dumper (Wheeled)', '1–3 t', 'Diesel', 4.5, 'L/hr', 12.1, true, 33),
  ('Site Dumper (Tracked)', '2–5 t', 'Diesel', 6.5, 'L/hr', 17.4, true, 34),
  ('Forklift', '3–4 t', 'Electric', 5, 'kWh/hr', 0.51, true, 35),
  ('Forklift', '3–5 t', 'Diesel', 3.5, 'L/hr', 9.4, true, 36),
  ('Telehandler', '6–12 t', 'Diesel', 7.5, 'L/hr', 20.1, true, 37),
  ('Mobile Crane', '15–25 t', 'Diesel', 15, 'L/hr', 40.2, true, 38),
  ('Mobile Crane', '30–50 t', 'Diesel', 28, 'L/hr', 75, true, 39)
) AS v(name, weight_range, fuel_type, avg_consumption_per_hr, consumption_unit, conversion_factor_kgco2e_per_unit, is_active, sort_order);
