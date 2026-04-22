alter table if exists public.users enable row level security;
alter table if exists public.bookings enable row level security;
alter table if exists public.tour_operators enable row level security;
alter table if exists public.rooms enable row level security;
alter table if exists public.room_rates enable row level security;
alter table if exists public.gallery_images enable row level security;
alter table if exists public.notification_logs enable row level security;

drop policy if exists "users_self_select" on public.users;
create policy "users_self_select"
on public.users
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "users_self_update" on public.users;
create policy "users_self_update"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "bookings_owner_select" on public.bookings;
create policy "bookings_owner_select"
on public.bookings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "bookings_owner_update" on public.bookings;
create policy "bookings_owner_update"
on public.bookings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "rooms_public_read" on public.rooms;
create policy "rooms_public_read"
on public.rooms
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "room_rates_public_read" on public.room_rates;
create policy "room_rates_public_read"
on public.room_rates
for select
to anon, authenticated
using (true);

drop policy if exists "gallery_images_public_read" on public.gallery_images;
create policy "gallery_images_public_read"
on public.gallery_images
for select
to anon, authenticated
using (true);

drop policy if exists "notification_logs_no_client_access" on public.notification_logs;
create policy "notification_logs_no_client_access"
on public.notification_logs
for select
to authenticated
using (false);
