begin;

alter table public.room_rates
  add column if not exists rate_date date,
  add column if not exists base_price numeric,
  add column if not exists child_price numeric;

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

create table if not exists public.meal_prices (
  id uuid primary key default uuid_generate_v4(),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  price numeric not null check (price >= 0),
  applicable_from date null,
  applicable_to date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meal_prices_meal_type_date_window_idx
  on public.meal_prices (meal_type, applicable_from, applicable_to);

commit;
