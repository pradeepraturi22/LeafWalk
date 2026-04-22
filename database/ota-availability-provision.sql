begin;

create table if not exists public.ota_availability_channels (
  id uuid primary key default gen_random_uuid(),
  channel_code text not null unique,
  channel_name text not null,
  is_active boolean not null default true,
  webhook_url text,
  api_endpoint text,
  auth_type text,
  auth_config jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ota_availability_outbox (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.ota_availability_channels(id) on delete cascade,
  room_category text not null,
  availability_date date not null,
  total_rooms integer not null default 0,
  booked_rooms integer not null default 0,
  available_rooms integer not null default 0,
  payload jsonb,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'processing', 'synced', 'failed')),
  retry_count integer not null default 0,
  last_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, room_category, availability_date)
);

create index if not exists ota_availability_outbox_status_idx
  on public.ota_availability_outbox (sync_status, availability_date);

create index if not exists ota_availability_outbox_channel_idx
  on public.ota_availability_outbox (channel_id, availability_date desc);

drop trigger if exists update_ota_availability_channels_updated_at on public.ota_availability_channels;
create trigger update_ota_availability_channels_updated_at
before update on public.ota_availability_channels
for each row execute function update_updated_at_column();

drop trigger if exists update_ota_availability_outbox_updated_at on public.ota_availability_outbox;
create trigger update_ota_availability_outbox_updated_at
before update on public.ota_availability_outbox
for each row execute function update_updated_at_column();

commit;
