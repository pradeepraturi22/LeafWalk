begin;

create extension if not exists "uuid-ossp";

create table if not exists public.otps (
  id uuid primary key default uuid_generate_v4(),
  contact text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.otps
  add column if not exists consumed_at timestamptz;

create index if not exists otps_contact_created_idx
  on public.otps (contact, created_at desc);

create index if not exists otps_contact_expires_idx
  on public.otps (contact, expires_at desc);

create index if not exists otps_contact_active_idx
  on public.otps (contact, expires_at desc)
  where consumed_at is null;

delete from public.otps
where expires_at < now();

alter table public.users
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists email_verified boolean not null default false,
  add column if not exists phone_verified boolean not null default false;

update public.users
set email = lower(email)
where email is not null
  and email <> lower(email);

alter table public.users
  alter column name drop not null;

create unique index if not exists users_email_lower_uidx
  on public.users (lower(email))
  where email is not null;

create index if not exists users_email_idx
  on public.users (email);

commit;
