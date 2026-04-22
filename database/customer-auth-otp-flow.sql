begin;

create unique index if not exists users_phone_unique_idx
  on public.users (phone)
  where phone is not null;

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in ('booking_confirmation', 'payment_success', 'checkin_reminder', 'otp_login')),
  recipient_email text not null,
  subject text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider text,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_events_booking_idx
  on public.email_events (booking_id, event_type, created_at desc);

commit;
