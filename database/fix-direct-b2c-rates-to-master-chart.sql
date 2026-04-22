BEGIN;

WITH season_map AS (
  SELECT id, name
  FROM public.seasons
  WHERE name IN ('peak', 'monsoon', 'moderate', 'off')
),
target_rates AS (
  SELECT *
  FROM (
    VALUES
      ('deluxe',  'peak',     'EP', 3800::numeric,  900::numeric,   0::numeric),
      ('deluxe',  'peak',     'CP', 4200::numeric, 1300::numeric, 600::numeric),
      ('deluxe',  'peak',     'MAP',6200::numeric, 1700::numeric, 600::numeric),
      ('premium', 'peak',     'EP', 5800::numeric, 1100::numeric,   0::numeric),
      ('premium', 'peak',     'CP', 6200::numeric, 1500::numeric, 600::numeric),
      ('premium', 'peak',     'MAP',7800::numeric, 1900::numeric, 600::numeric),

      ('deluxe',  'monsoon',  'EP', 3000::numeric,  900::numeric,   0::numeric),
      ('deluxe',  'monsoon',  'CP', 3300::numeric, 1300::numeric, 600::numeric),
      ('deluxe',  'monsoon',  'MAP',5200::numeric, 1700::numeric, 600::numeric),
      ('premium', 'monsoon',  'EP', 4800::numeric, 1100::numeric,   0::numeric),
      ('premium', 'monsoon',  'CP', 5200::numeric, 1500::numeric, 600::numeric),
      ('premium', 'monsoon',  'MAP',6700::numeric, 1900::numeric, 600::numeric),

      ('deluxe',  'moderate', 'EP', 3400::numeric,  900::numeric,   0::numeric),
      ('deluxe',  'moderate', 'CP', 3800::numeric, 1300::numeric, 600::numeric),
      ('deluxe',  'moderate', 'MAP',5800::numeric, 1700::numeric, 600::numeric),
      ('premium', 'moderate', 'EP', 5400::numeric, 1100::numeric,   0::numeric),
      ('premium', 'moderate', 'CP', 5800::numeric, 1500::numeric, 600::numeric),
      ('premium', 'moderate', 'MAP',7200::numeric, 1900::numeric, 600::numeric),

      ('deluxe',  'off',      'EP', 2600::numeric,  900::numeric,   0::numeric),
      ('deluxe',  'off',      'CP', 3000::numeric, 1300::numeric, 600::numeric),
      ('deluxe',  'off',      'MAP',4800::numeric, 1700::numeric, 600::numeric),
      ('premium', 'off',      'EP', 4400::numeric, 1100::numeric,   0::numeric),
      ('premium', 'off',      'CP', 4800::numeric, 1500::numeric, 600::numeric),
      ('premium', 'off',      'MAP',6200::numeric, 1900::numeric, 600::numeric)
  ) AS t(room_category, season_name, meal_plan, price_per_night, extra_bed_price, child_5_12_price)
)
UPDATE public.room_rates rr
SET
  price_per_night = tr.price_per_night,
  extra_bed_price = tr.extra_bed_price,
  child_5_12_price = tr.child_5_12_price,
  updated_at = now()
FROM target_rates tr
JOIN season_map sm ON sm.name = tr.season_name
WHERE rr.room_category = tr.room_category
  AND rr.season_id = sm.id
  AND rr.meal_plan = tr.meal_plan
  AND rr.rate_type = 'b2c';

COMMIT;
