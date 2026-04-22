begin;

alter table public.room_rates
  add column if not exists specific_date date null,
  add column if not exists is_date_override boolean not null default false;

create index if not exists room_rates_room_category_rate_type_specific_date_idx
  on public.room_rates (room_category, rate_type, specific_date);

create unique index if not exists room_rates_unique_lwweb_date_override
  on public.room_rates (room_category, meal_plan, rate_type, specific_date)
  where (is_date_override = true and specific_date is not null);

commit;
