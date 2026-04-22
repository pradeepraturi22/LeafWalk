create or replace function public.get_lwweb_nightly_pricing(
  p_room_category text,
  p_meal_plan text,
  p_check_in date,
  p_check_out date
)
returns table (
  date date,
  price numeric,
  extra_bed_price numeric,
  child_price numeric,
  source text
)
language sql
stable
as $$
with requested_dates as (
  select generate_series(p_check_in, p_check_out - interval '1 day', interval '1 day')::date as stay_date
),
override_candidates as (
  select
    rd.stay_date,
    rr.price_per_night,
    rr.extra_bed_price,
    rr.child_5_12_price,
    row_number() over (
      partition by rd.stay_date
      order by rr.created_at desc nulls last, rr.id desc
    ) as row_num
  from requested_dates rd
  join public.room_rates rr
    on rr.room_category = p_room_category
   and rr.meal_plan = p_meal_plan
   and rr.rate_type = 'lwweb'
   and rr.is_date_override = true
   and rr.specific_date = rd.stay_date
),
seasonal_candidates as (
  select
    rd.stay_date,
    rr.price_per_night,
    rr.extra_bed_price,
    rr.child_5_12_price,
    row_number() over (
      partition by rd.stay_date
      order by s.sort_order asc nulls last, rr.created_at desc nulls last, rr.id desc
    ) as row_num
  from requested_dates rd
  join public.room_rates rr
    on rr.room_category = p_room_category
   and rr.meal_plan = p_meal_plan
   and rr.rate_type = 'lwweb'
   and coalesce(rr.is_date_override, false) = false
  join public.seasons s
    on s.id = rr.season_id
   and (
     case
       when (s.start_month * 100 + s.start_day) <= (s.end_month * 100 + s.end_day)
         then (
           (extract(month from rd.stay_date)::int * 100 + extract(day from rd.stay_date)::int)
           between (s.start_month * 100 + s.start_day) and (s.end_month * 100 + s.end_day)
         )
       else (
         (extract(month from rd.stay_date)::int * 100 + extract(day from rd.stay_date)::int) >= (s.start_month * 100 + s.start_day)
         or
         (extract(month from rd.stay_date)::int * 100 + extract(day from rd.stay_date)::int) <= (s.end_month * 100 + s.end_day)
       )
     end
   )
)
select
  rd.stay_date as date,
  coalesce(ov.price_per_night, sr.price_per_night) as price,
  coalesce(ov.extra_bed_price, sr.extra_bed_price, 0) as extra_bed_price,
  coalesce(ov.child_5_12_price, sr.child_5_12_price, 0) as child_price,
  case when ov.price_per_night is not null then 'date_override' else 'seasonal' end as source
from requested_dates rd
left join override_candidates ov
  on ov.stay_date = rd.stay_date
 and ov.row_num = 1
left join seasonal_candidates sr
  on sr.stay_date = rd.stay_date
 and sr.row_num = 1
order by rd.stay_date;
$$;

-- Example:
-- select * from public.get_lwweb_nightly_pricing('deluxe', 'EP', date '2026-05-10', date '2026-05-12');
