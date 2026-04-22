-- Sync rooms.display_price_from from direct (b2c) off-season room-only (EP) rates
-- Date: 2026-03-13

BEGIN;

WITH off_season_rates AS (
  SELECT
    rr.room_category,
    rr.price_per_night
  FROM public.room_rates rr
  JOIN public.seasons s ON s.id = rr.season_id
  WHERE s.name = 'off'
    AND rr.rate_type = 'b2c'
    AND rr.meal_plan = 'EP'
)
UPDATE public.rooms r
SET
  display_price_from = osr.price_per_night,
  updated_at = now()
FROM off_season_rates osr
WHERE r.category = osr.room_category;

COMMIT;
