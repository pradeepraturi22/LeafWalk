create table if not exists public.rate_limit_buckets (
  key text primary key,
  route text not null,
  window_start timestamptz not null,
  reset_at timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists rate_limit_buckets_reset_at_idx on public.rate_limit_buckets (reset_at);
create index if not exists rate_limit_buckets_route_idx on public.rate_limit_buckets (route);

create or replace function public.consume_rate_limit(
  p_key text,
  p_route text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  current_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_reset timestamptz;
  v_row public.rate_limit_buckets%rowtype;
begin
  v_window_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_reset := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.rate_limit_buckets as buckets (
    key,
    route,
    window_start,
    reset_at,
    count,
    updated_at
  )
  values (
    p_key,
    p_route,
    v_window_start,
    v_reset,
    1,
    v_now
  )
  on conflict (key) do update
  set
    route = excluded.route,
    window_start = case when buckets.reset_at <= v_now then excluded.window_start else buckets.window_start end,
    reset_at = case when buckets.reset_at <= v_now then excluded.reset_at else buckets.reset_at end,
    count = case when buckets.reset_at <= v_now then 1 else buckets.count + 1 end,
    updated_at = v_now
  returning * into v_row;

  return query
  select
    v_row.count <= p_limit,
    greatest(p_limit - v_row.count, 0),
    v_row.reset_at,
    v_row.count;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

create unique index if not exists payments_razorpay_payment_id_uidx
  on public.payments (razorpay_payment_id)
  where razorpay_payment_id is not null;

create unique index if not exists bookings_razorpay_payment_id_uidx
  on public.bookings (razorpay_payment_id)
  where razorpay_payment_id is not null;

create unique index if not exists booking_payments_method_ref_uidx
  on public.booking_payments (payment_method, payment_ref);

create index if not exists bookings_razorpay_order_id_idx
  on public.bookings (razorpay_order_id);

create index if not exists payments_booking_id_idx
  on public.payments (booking_id);

create index if not exists booking_payments_booking_id_idx
  on public.booking_payments (booking_id);

alter table public.bookings
  drop constraint if exists bookings_amounts_non_negative;

alter table public.bookings
  add constraint bookings_amounts_non_negative
  check (
    coalesce(total_amount, 0) >= 0 and
    coalesce(advance_amount, 0) >= 0 and
    coalesce(balance_amount, 0) >= 0
  );

alter table public.payments
  drop constraint if exists payments_amount_non_negative;

alter table public.payments
  add constraint payments_amount_non_negative
  check (coalesce(amount, 0) >= 0);

alter table public.booking_payments
  drop constraint if exists booking_payments_amount_non_negative;

alter table public.booking_payments
  add constraint booking_payments_amount_non_negative
  check (coalesce(amount, 0) >= 0);
