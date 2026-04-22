begin;

create extension if not exists "uuid-ossp";

create table if not exists public.otps (
  id uuid primary key default uuid_generate_v4(),
  contact text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists otps_contact_created_idx
  on public.otps (contact, created_at desc);

create index if not exists otps_contact_expires_idx
  on public.otps (contact, expires_at desc);

alter table public.users
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists email_verified boolean not null default false,
  add column if not exists phone_verified boolean not null default false;

create unique index if not exists users_email_unique_idx
  on public.users (lower(email))
  where email is not null;

create unique index if not exists users_phone_unique_idx
  on public.users (phone)
  where phone is not null;

commit;
