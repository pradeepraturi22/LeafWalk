BEGIN;

-- Allow the new public website tariff type.
ALTER TABLE public.room_rates
DROP CONSTRAINT IF EXISTS room_rates_rate_type_check;

ALTER TABLE public.room_rates
ADD CONSTRAINT room_rates_rate_type_check
CHECK (
  rate_type::text = ANY (
    ARRAY[
      'lwweb'::text,
      'b2b'::text,
      'b2c'::text,
      'ota'::text
    ]
  )
);

-- Admin-created bookings can now be explicitly tagged with the LWWEB tariff too.
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_booking_type_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_booking_type_check
CHECK (
  booking_type::text = ANY (
    ARRAY[
      'lwweb'::text,
      'b2b'::text,
      'b2c'::text
    ]
  )
);

-- Prevent duplicate tariff rows for the same seasonal slot.
CREATE UNIQUE INDEX IF NOT EXISTS room_rates_unique_tariff_slot
ON public.room_rates (room_category, season_id, meal_plan, rate_type);

COMMIT;
