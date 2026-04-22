begin;

create extension if not exists "uuid-ossp";

create table if not exists public.restaurant_bills (
  id uuid primary key default uuid_generate_v4(),
  customer_name text not null,
  mobile text null,
  table_no text null,
  subtotal numeric(10,2) not null default 0,
  gst numeric(10,2) not null default 0,
  grand_total numeric(10,2) not null default 0,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_bill_items (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid not null references public.restaurant_bills(id) on delete cascade,
  item_id uuid null references public.restaurant_menu_items(id) on delete set null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit text null,
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_bills_created_at_idx on public.restaurant_bills(created_at desc);
create index if not exists restaurant_bill_items_bill_idx on public.restaurant_bill_items(bill_id);

commit;
