-- Bulk set default densities (kg/m3) and kg_per_m (kg/m) for current waste streams.
-- Safe: only sets values when currently NULL (coalesce). Keys match existing waste_streams.key (hyphenated).

UPDATE public.waste_streams
SET
  default_density_kg_m3 = COALESCE(default_density_kg_m3,
    CASE key
      WHEN 'plasterboard-gib'              THEN 850
      WHEN 'timber-untreated'              THEN 500
      WHEN 'timber-treated'                THEN 600
      WHEN 'metals'                        THEN 7850
      WHEN 'cardboard'                     THEN 120
      WHEN 'soft-plastics-wrap-strapping'  THEN 60
      WHEN 'hard-plastics'                 THEN 950
      WHEN 'mixed-c-d'                     THEN 350
      WHEN 'concrete-reinforced'           THEN 2400
      ELSE NULL
    END
  ),
  default_kg_per_m = COALESCE(default_kg_per_m,
    CASE key
      WHEN 'timber-untreated' THEN 3.5
      WHEN 'timber-treated'   THEN 4.0
      ELSE NULL
    END
  )
WHERE is_active = true;

-- Verify (optional; comment out in migration if you prefer no SELECT)
-- SELECT key, name, default_density_kg_m3, default_kg_per_m
-- FROM public.waste_streams
-- ORDER BY sort_order;
