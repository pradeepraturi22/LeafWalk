insert into public.room_rates (
  room_category,
  meal_plan,
  rate_type,
  price_per_night,
  extra_bed_price,
  child_5_12_price,
  specific_date,
  is_date_override
)
values (
  $1,           -- room_category
  $2,           -- meal_plan
  'lwweb',
  $3,           -- room price
  coalesce($4, 0), -- extra bed price
  coalesce($5, 0), -- child price
  $6::date,     -- specific date
  true
)
on conflict (room_category, meal_plan, rate_type, specific_date)
where (is_date_override = true and specific_date is not null)
do update
set
  price_per_night = excluded.price_per_night,
  extra_bed_price = excluded.extra_bed_price,
  child_5_12_price = excluded.child_5_12_price,
  is_date_override = true;
