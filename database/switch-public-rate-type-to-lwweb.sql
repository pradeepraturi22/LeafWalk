BEGIN;

-- 1. Allow lwweb in room_rates.rate_type.
ALTER TABLE public.room_rates
DROP CONSTRAINT IF EXISTS room_rates_rate_type_check;

ALTER TABLE public.room_rates
ADD CONSTRAINT room_rates_rate_type_check
CHECK (rate_type::text = ANY (ARRAY[
  'lwweb'::text,
  'b2b'::text,
  'b2c'::text,
  'ota'::text
]));

-- 2. Move the intended website tariff rows from b2b to lwweb
--    for the legacy autumn/offseason set you shared.
UPDATE public.room_rates rr
SET rate_type = 'lwweb'
FROM public.seasons s
WHERE rr.season_id = s.id
  AND rr.rate_type = 'b2b'
  AND s.name IN ('autumn', 'offseason');

COMMIT;

-- Verification:
-- select rr.room_category, rr.meal_plan, rr.rate_type, rr.price_per_night, s.name
-- from public.room_rates rr
-- join public.seasons s on s.id = rr.season_id
-- where rr.rate_type = 'lwweb'
-- order by rr.room_category, rr.meal_plan, s.name;
