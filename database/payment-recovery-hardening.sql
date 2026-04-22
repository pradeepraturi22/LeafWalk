create table if not exists public.processed_payment_events (
  id bigserial primary key,
  event_key text not null,
  event_type text not null,
  booking_id uuid null references public.bookings(id) on delete set null,
  razorpay_payment_id text null,
  razorpay_order_id text null,
  payload_json jsonb null,
  processed_at timestamptz not null default now()
);

create unique index if not exists processed_payment_events_event_key_uidx
  on public.processed_payment_events (event_key);

create index if not exists processed_payment_events_order_idx
  on public.processed_payment_events (razorpay_order_id);

create index if not exists processed_payment_events_payment_idx
  on public.processed_payment_events (razorpay_payment_id);

create unique index if not exists promo_code_usage_booking_offer_uidx
  on public.promo_code_usage (booking_id, offer_id);

alter table public.bookings
  alter column payment_status set default 'pending';

update public.bookings
set payment_status = case
  when payment_status is null or btrim(payment_status) = '' then 'pending'
  when lower(payment_status) = 'paid' then 'fully_paid'
  when lower(payment_status) = 'advance_paid' then 'payment_processing'
  when lower(payment_status) in ('pending', 'payment_processing', 'fully_paid', 'failed', 'refunded') then lower(payment_status)
  else 'pending'
end;

update public.bookings
set booking_status = case
  when booking_status is null or btrim(booking_status) = '' then 'pending'
  when lower(booking_status) = 'completed' then 'checked_out'
  when lower(booking_status) in ('pending', 'hold', 'confirmed', 'cancelled', 'checked_in', 'checked_out') then lower(booking_status)
  else 'pending'
end;

alter table public.bookings
  drop constraint if exists bookings_payment_status_allowed;

alter table public.bookings
  add constraint bookings_payment_status_allowed
  check (
    payment_status in ('pending', 'payment_processing', 'fully_paid', 'failed', 'refunded')
  );

alter table public.bookings
  drop constraint if exists bookings_status_allowed;

alter table public.bookings
  add constraint bookings_status_allowed
  check (
    booking_status in ('pending', 'hold', 'confirmed', 'cancelled', 'checked_in', 'checked_out')
  );

create index if not exists bookings_payment_status_idx
  on public.bookings (payment_status);

create index if not exists bookings_order_payment_status_idx
  on public.bookings (razorpay_order_id, payment_status);
