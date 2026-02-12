-- Best-effort: map legacy partner/facility text in swmp_inputs.inputs to partner_id/facility_id (UUIDs).
-- Leaves legacy columns (partner, destination) intact for fallback display.
-- Run once after catalog (partners/facilities) is populated.

DO $$
DECLARE
  rec RECORD;
  plans jsonb;
  plan jsonb;
  new_plans jsonb := '[]'::jsonb;
  i int;
  matched_partner_id uuid;
  matched_facility_id uuid;
  partner_text text;
  dest_text text;
BEGIN
  FOR rec IN SELECT id, inputs FROM public.swmp_inputs WHERE inputs ? 'waste_stream_plans'
  LOOP
    plans := rec.inputs->'waste_stream_plans';
    new_plans := '[]'::jsonb;

    FOR i IN 0..(jsonb_array_length(plans) - 1)
    LOOP
      plan := plans->i;
      matched_partner_id := NULL;
      matched_facility_id := NULL;

      -- Only try to match when partner_id is missing or not a valid UUID (36-char hex with dashes)
      IF (plan->>'partner_id') IS NULL OR (plan->>'partner_id') = '' OR (plan->>'partner_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        partner_text := trim(plan->>'partner');
        IF partner_text <> '' THEN
          SELECT id INTO matched_partner_id
          FROM public.partners
          WHERE name = partner_text OR name ILIKE partner_text
          LIMIT 1;
        END IF;
      END IF;

      -- Only try to match facility when facility_id is missing or not a valid UUID
      IF (plan->>'facility_id') IS NULL OR (plan->>'facility_id') = '' OR (plan->>'facility_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        dest_text := trim(COALESCE(plan->>'destination_override', plan->>'destination', ''));
        IF dest_text <> '' AND (matched_partner_id IS NOT NULL OR (plan->>'partner_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') THEN
          SELECT f.id INTO matched_facility_id
          FROM public.facilities f
          WHERE (
            f.partner_id = matched_partner_id
            OR ((plan->>'partner_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND f.partner_id = (plan->>'partner_id')::uuid)
          )
            AND (f.name = dest_text OR f.name ILIKE dest_text OR f.address ILIKE '%' || dest_text || '%')
          LIMIT 1;
        END IF;
      END IF;

      -- Build updated plan: set partner_id/facility_id when we have a match, keep rest
      plan := plan
        || CASE WHEN matched_partner_id IS NOT NULL THEN jsonb_build_object('partner_id', matched_partner_id::text) ELSE '{}'::jsonb END
        || CASE WHEN matched_facility_id IS NOT NULL THEN jsonb_build_object('facility_id', matched_facility_id::text) ELSE '{}'::jsonb END;
      new_plans := new_plans || jsonb_build_array(plan);
    END LOOP;

    UPDATE public.swmp_inputs
    SET inputs = jsonb_set(inputs, '{waste_stream_plans}', new_plans)
    WHERE id = rec.id;
  END LOOP;
END $$;
