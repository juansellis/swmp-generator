-- Seed conversion_factors from waste_streams defaults (idempotent).
-- m3 -> kg using waste_streams.default_density_kg_m3 (where not null).
-- m -> kg using waste_streams.default_kg_per_m (where not null).
-- Also seed tonne->kg and kg->kg for every stream so conversions always resolve.

INSERT INTO public.conversion_factors (waste_stream_id, from_unit, to_unit, factor, is_active, notes, updated_at)
SELECT id, 'tonne', 'kg', 1000, true, 'seed', now() FROM public.waste_streams WHERE is_active = true
UNION ALL
SELECT id, 'kg', 'kg', 1, true, 'seed', now() FROM public.waste_streams WHERE is_active = true
UNION ALL
SELECT id, 'm3', 'kg', default_density_kg_m3, true, 'seed from waste_streams.default_density_kg_m3', now()
  FROM public.waste_streams WHERE is_active = true AND default_density_kg_m3 IS NOT NULL
UNION ALL
SELECT id, 'm', 'kg', default_kg_per_m, true, 'seed from waste_streams.default_kg_per_m', now()
  FROM public.waste_streams WHERE is_active = true AND default_kg_per_m IS NOT NULL
ON CONFLICT (waste_stream_id, from_unit, to_unit)
DO UPDATE SET factor = EXCLUDED.factor, is_active = EXCLUDED.is_active, notes = EXCLUDED.notes, updated_at = now();
