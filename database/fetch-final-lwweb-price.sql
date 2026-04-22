with override_rate as (
  select
    rr.room_category,
    rr.meal_plan,
    rr.rate_type,
    rr.price_per_night,
    rr.extra_bed_price,
    rr.child_5_12_price,
    rr.specific_date,
    null::uuid as season_id,
    null::text as season_name,
    1 as priority
  from public.room_rates rr
  where rr.room_category = $1
    and rr.meal_plan = $2
    and rr.rate_type = 'lwweb'
    and rr.is_date_override = true
    and rr.specific_date = $3::date
),
season_rate as (
  select
    rr.room_category,
    rr.meal_plan,
    rr.rate_type,
    rr.price_per_night,
    rr.extra_bed_price,
    rr.child_5_12_price,
    null::date as specific_date,
    s.id as season_id,
    s.name as season_name,
    2 as priority
  from public.room_rates rr
  join public.seasons s on s.id = rr.season_id
  where rr.room_category = $1
    and rr.meal_plan = $2
    and rr.rate_type = 'lwweb'
    and coalesce(rr.is_date_override, false) = false
    and (
      case
        when (s.start_month * 100 + s.start_day) <= (s.end_month * 100 + s.end_day)
          then (
            (extract(month from $3::date)::int * 100 + extract(day from $3::date)::int)
            between (s.start_month * 100 + s.start_day) and (s.end_month * 100 + s.end_day)
          )
        else (
          (extract(month from $3::date)::int * 100 + extract(day from $3::date)::int) >= (s.start_month * 100 + s.start_day)
          or
          (extract(month from $3::date)::int * 100 + extract(day from $3::date)::int) <= (s.end_month * 100 + s.end_day)
        )
      end
    )
)
select *
from (
  select * from override_rate
  union all
  select * from season_rate
) final_rate
order by priority
limit 1;
