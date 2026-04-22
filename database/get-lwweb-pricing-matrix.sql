create or replace function public.get_lwweb_pricing_matrix(
  p_room_category text,
  p_check_in date,
  p_check_out date
)
returns table (
  date date,
  ep_price numeric,
  cp_price numeric,
  map_price numeric,
  ap_price numeric,
  extra_bed_price numeric,
  child_price numeric
)
language sql
stable
as $$
with requested_dates as (
  select generate_series(p_check_in, p_check_out - interval '1 day', interval '1 day')::date as stay_date
),
base_rates as (
  select
    rd.stay_date,
    rr.base_price,
    rr.extra_bed_price,
    rr.child_price,
    row_number() over (
      partition by rd.stay_date
      order by rr.created_at desc nulls last, rr.id desc
    ) as row_num
  from requested_dates rd
  join public.room_rates rr
    on rr.room_category = p_room_category
   and rr.rate_type = 'lwweb'
   and rr.rate_date = rd.stay_date
),
meal_lookup as (
  select
    rd.stay_date,
    mp.meal_type,
    mp.price,
    row_number() over (
      partition by rd.stay_date, mp.meal_type
      order by mp.applicable_from desc nulls last, mp.created_at desc nulls last, mp.id desc
    ) as row_num
  from requested_dates rd
  join public.meal_prices mp
    on (mp.applicable_from is null or mp.applicable_from <= rd.stay_date)
   and (mp.applicable_to is null or mp.applicable_to >= rd.stay_date)
),
breakfast as (
  select stay_date, price from meal_lookup where meal_type = 'breakfast' and row_num = 1
),
lunch as (
  select stay_date, price from meal_lookup where meal_type = 'lunch' and row_num = 1
),
dinner as (
  select stay_date, price from meal_lookup where meal_type = 'dinner' and row_num = 1
)
select
  rd.stay_date as date,
  br.base_price as ep_price,
  br.base_price + coalesce(bf.price, 0) as cp_price,
  br.base_price + coalesce(bf.price, 0) + coalesce(dn.price, 0) as map_price,
  br.base_price + coalesce(bf.price, 0) + coalesce(ln.price, 0) + coalesce(dn.price, 0) as ap_price,
  coalesce(br.extra_bed_price, 0) as extra_bed_price,
  coalesce(br.child_price, 0) as child_price
from requested_dates rd
left join base_rates br on br.stay_date = rd.stay_date and br.row_num = 1
left join breakfast bf on bf.stay_date = rd.stay_date
left join lunch ln on ln.stay_date = rd.stay_date
left join dinner dn on dn.stay_date = rd.stay_date
order by rd.stay_date;
$$;

-- Example:
-- select * from public.get_lwweb_pricing_matrix('deluxe', date '2026-05-10', date '2026-05-12');
