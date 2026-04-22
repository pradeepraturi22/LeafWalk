-- Leafwalk Resort master direct + OTA pricing setup
-- Date: 2026-03-13
--
-- Mapping:
--   Room Only                 -> EP
--   With Breakfast            -> CP
--   Breakfast + Dinner        -> MAP
--   Direct Booking            -> rate_type = 'b2c'
--   OTA                       -> rate_type = 'ota'
--
-- Pricing source used:
--   The "Master Rate Chart" values below are seeded directly into b2c
--   because the public website currently reads b2c rates.
--   OTA rates are stored separately for future integration/admin usage.
--
-- Extra-bed policy seeded from your chart:
--   Deluxe  EP  900 | CP 1300 | MAP 1700
--   Premium EP 1100 | CP 1500 | MAP 1900
--
-- Child policy seeded into child_5_12_price:
--   CP  -> 600
--   EP  -> 0
--   MAP -> 600
--
-- Note:
--   The current public website logic reads b2c (direct) rates.
--   OTA rates are stored for upcoming OTA API integration and admin usage.

BEGIN;

-- 1. Ensure seasons exist with the requested date windows.
WITH season_seed AS (
  SELECT *
  FROM (
    VALUES
      ('peak',      'Peak Season',     4, 18,  6, 30, FALSE, 10),
      ('monsoon',   'Monsoon Season',  7,  1,  8, 31, FALSE, 20),
      ('moderate',  'Moderate Season', 9,  1, 11, 15, FALSE, 30),
      ('off',       'Off Season',     11, 16,  3, 31, FALSE, 40)
  ) AS t(name, label, start_month, start_day, end_month, end_day, is_yatra_season, sort_order)
)
UPDATE public.seasons AS s
SET
  label = ss.label,
  start_month = ss.start_month,
  start_day = ss.start_day,
  end_month = ss.end_month,
  end_day = ss.end_day,
  is_yatra_season = ss.is_yatra_season,
  sort_order = ss.sort_order
FROM season_seed ss
WHERE s.name = ss.name;

INSERT INTO public.seasons (
  name,
  label,
  start_month,
  start_day,
  end_month,
  end_day,
  is_yatra_season,
  sort_order
)
SELECT
  ss.name,
  ss.label,
  ss.start_month,
  ss.start_day,
  ss.end_month,
  ss.end_day,
  ss.is_yatra_season,
  ss.sort_order
FROM (
  VALUES
    ('peak',      'Peak Season',     4, 18,  6, 30, FALSE, 10),
    ('monsoon',   'Monsoon Season',  7,  1,  8, 31, FALSE, 20),
    ('moderate',  'Moderate Season', 9,  1, 11, 15, FALSE, 30),
    ('off',       'Off Season',     11, 16,  3, 31, FALSE, 40)
) AS ss(name, label, start_month, start_day, end_month, end_day, is_yatra_season, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.seasons s WHERE s.name = ss.name
);

-- 2. Prepare direct rates from the supplied master chart.
WITH season_map AS (
  SELECT id, name
  FROM public.seasons
  WHERE name IN ('peak', 'monsoon', 'moderate', 'off')
),
direct_seed AS (
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
  ) AS t(room_category, season_name, meal_plan, direct_price, extra_bed_price, child_5_12_price)
),
all_target_rates AS (
  SELECT
    ds.room_category,
    sm.id AS season_id,
    ds.meal_plan,
    'b2c'::text AS rate_type,
    ds.direct_price AS price_per_night,
    ds.extra_bed_price,
    ds.child_5_12_price
  FROM direct_seed ds
  JOIN season_map sm ON sm.name = ds.season_name

  UNION ALL

  SELECT
    ds.room_category,
    sm.id AS season_id,
    ds.meal_plan,
    'ota'::text AS rate_type,
    ds.direct_price AS price_per_night,
    ds.extra_bed_price,
    ds.child_5_12_price
  FROM direct_seed ds
  JOIN season_map sm ON sm.name = ds.season_name
),
updated AS (
  UPDATE public.room_rates rr
  SET
    price_per_night = atr.price_per_night,
    extra_bed_price = atr.extra_bed_price,
    child_5_12_price = atr.child_5_12_price,
    updated_at = now()
  FROM all_target_rates atr
  WHERE rr.room_category = atr.room_category
    AND rr.season_id = atr.season_id
    AND rr.meal_plan = atr.meal_plan
    AND rr.rate_type = atr.rate_type
  RETURNING rr.room_category, rr.season_id, rr.meal_plan, rr.rate_type
)
INSERT INTO public.room_rates (
  room_category,
  season_id,
  meal_plan,
  rate_type,
  price_per_night,
  extra_bed_price,
  child_5_12_price
)
SELECT
  atr.room_category,
  atr.season_id,
  atr.meal_plan,
  atr.rate_type,
  atr.price_per_night,
  atr.extra_bed_price,
  atr.child_5_12_price
FROM all_target_rates atr
WHERE NOT EXISTS (
  SELECT 1
  FROM public.room_rates rr
  WHERE rr.room_category = atr.room_category
    AND rr.season_id = atr.season_id
    AND rr.meal_plan = atr.meal_plan
    AND rr.rate_type = atr.rate_type
);

COMMIT;

-- Optional display-price sync:
-- If you want, set rooms.display_price_from manually to your preferred
-- public-facing "from" rate after reviewing these seeded prices.
