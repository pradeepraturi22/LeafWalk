begin;

alter table public.room_rates
  add column if not exists rate_date date,
  add column if not exists base_price numeric,
  add column if not exists extra_bed_price numeric default 0,
  add column if not exists child_price numeric default 0;

alter table public.room_rates
  alter column season_id drop not null;

alter table public.room_rates
  alter column meal_plan drop not null;

alter table public.room_rates
  alter column price_per_night drop not null;

drop index if exists public.room_rates_unique_room_type_date;

drop index if exists public.room_rates_unique_tariff_slot;

alter table public.room_rates
  drop constraint if exists room_rates_unique;

create unique index if not exists room_rates_unique_room_type_date
  on public.room_rates (room_category, rate_type, rate_date)
  where rate_date is not null;

create index if not exists room_rates_calendar_fetch_idx
  on public.room_rates (room_category, rate_type, rate_date);

commit;
