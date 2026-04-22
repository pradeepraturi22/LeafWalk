begin;

alter table public.users
  add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_auth_user_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end $$;

update public.users
set email = lower(email)
where email is not null
  and email <> lower(email);

update public.users u
set
  auth_user_id = au.id,
  email = lower(coalesce(u.email, au.email)),
  updated_at = now()
from auth.users au
where u.auth_user_id is null
  and (
    u.id = au.id
    or (
      u.email is not null
      and lower(u.email) = lower(au.email)
    )
  );

alter table public.users
  alter column name drop not null;

create unique index if not exists users_auth_user_id_uidx
  on public.users (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists users_email_lower_uidx
  on public.users (lower(email))
  where email is not null;

create index if not exists users_email_idx
  on public.users (email);

commit;
