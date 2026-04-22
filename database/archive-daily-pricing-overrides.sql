BEGIN;

-- 1. Create an archive table once so old overrides are preserved.
CREATE TABLE IF NOT EXISTS public.daily_pricing_archive (
  id integer PRIMARY KEY,
  date date NOT NULL,
  room_category text NOT NULL,
  base_price numeric NOT NULL,
  adjustment numeric NOT NULL DEFAULT 0,
  final_price numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text
);

-- 2. Preview rows that are currently overriding seasonal public tariffs.
--    Run this SELECT first if you want to inspect what will be archived.
-- SELECT *
-- FROM public.daily_pricing
-- WHERE date >= CURRENT_DATE
-- ORDER BY date, room_category;

-- 3. Archive all current/future overrides before deleting them from active use.
INSERT INTO public.daily_pricing_archive (
  id,
  date,
  room_category,
  base_price,
  adjustment,
  final_price,
  notes,
  created_by,
  created_at,
  updated_at,
  archive_reason
)
SELECT
  dp.id,
  dp.date,
  dp.room_category,
  dp.base_price,
  dp.adjustment,
  dp.final_price,
  dp.notes,
  dp.created_by,
  dp.created_at,
  dp.updated_at,
  'Archived after switching public website tariff flow to seasonal room_rates'
FROM public.daily_pricing dp
WHERE dp.date >= CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1
    FROM public.daily_pricing_archive ar
    WHERE ar.id = dp.id
  );

-- 4. Remove archived current/future overrides from the live table.
DELETE FROM public.daily_pricing
WHERE date >= CURRENT_DATE;

COMMIT;

-- Optional verification:
-- SELECT COUNT(*) AS active_daily_pricing_rows FROM public.daily_pricing WHERE date >= CURRENT_DATE;
-- SELECT COUNT(*) AS archived_daily_pricing_rows FROM public.daily_pricing_archive WHERE date >= CURRENT_DATE;
