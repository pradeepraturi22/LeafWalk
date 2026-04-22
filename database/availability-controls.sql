begin;

create extension if not exists "uuid-ossp";

create table if not exists public.availability_controls (
  id uuid primary key default uuid_generate_v4(),
  room_category text not null,
  control_date date not null,
  allowed_rooms integer not null check (allowed_rooms >= 0),
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists availability_controls_room_date_uidx
  on public.availability_controls (room_category, control_date);

create index if not exists availability_controls_date_idx
  on public.availability_controls (control_date);

commit;
