begin;

alter table public.bookings
  add column if not exists booking_number varchar(50),
  add column if not exists invoice_number varchar(50);

create unique index if not exists bookings_booking_number_uidx
  on public.bookings (booking_number)
  where booking_number is not null;

create unique index if not exists bookings_invoice_number_uidx
  on public.bookings (invoice_number)
  where invoice_number is not null;

update public.bookings
set booking_number =
  'LWB/' ||
  case
    when extract(month from coalesce(created_at, now())) >= 4
      then extract(year from coalesce(created_at, now()))::int::text || '-' || lpad(((extract(year from coalesce(created_at, now()))::int + 1) % 100)::text, 2, '0')
    else (extract(year from coalesce(created_at, now()))::int - 1)::text || '-' || lpad((extract(year from coalesce(created_at, now()))::int % 100)::text, 2, '0')
  end ||
  '/' || upper(left(replace(id::text, '-', ''), 8))
where booking_number is null;

update public.bookings
set invoice_number =
  'INV/' ||
  case
    when extract(month from coalesce(advance_paid_at, updated_at, now())) >= 4
      then extract(year from coalesce(advance_paid_at, updated_at, now()))::int::text || '-' || lpad(((extract(year from coalesce(advance_paid_at, updated_at, now()))::int + 1) % 100)::text, 2, '0')
    else (extract(year from coalesce(advance_paid_at, updated_at, now()))::int - 1)::text || '-' || lpad((extract(year from coalesce(advance_paid_at, updated_at, now()))::int % 100)::text, 2, '0')
  end ||
  '/' || upper(left(replace(id::text, '-', ''), 8))
where invoice_number is null
  and payment_status in ('fully_paid', 'advance_paid');

commit;
