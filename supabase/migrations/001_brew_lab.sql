create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.inventories (
  user_id uuid primary key references public.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  source text not null default 'manual' check (source in ('manual', 'brewfather')),
  synced_at timestamptz not null default now()
);

create table public.suppliers (
  user_id uuid not null references public.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 160),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 160),
  recipe jsonb not null check (jsonb_typeof(recipe) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_owner_updated on public.recipes(user_id, updated_at desc);

alter table public.users enable row level security;
alter table public.inventories enable row level security;
alter table public.suppliers enable row level security;
alter table public.recipes enable row level security;

create policy own_user_select on public.users for select to authenticated using ((select auth.uid()) = id);
create policy own_user_update on public.users for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy own_inventory on public.inventories for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_suppliers on public.suppliers for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_recipes on public.recipes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', '')) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.users(id, display_name) select id, coalesce(raw_user_meta_data->>'full_name', '') from auth.users on conflict (id) do nothing;
revoke all on function public.handle_new_user() from public;

create table public.api_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('ai', 'sync')),
  bucket timestamptz not null,
  requests integer not null default 1,
  primary key (user_id, action, bucket)
);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;

create function public.consume_api_quota(action_name text) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  current_bucket timestamptz := date_trunc('hour', now());
  current_requests integer;
  max_requests integer;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if action_name = 'ai' then max_requests := 30;
  elsif action_name = 'sync' then max_requests := 6;
  else raise exception 'Invalid action'; end if;
  delete from public.api_usage where user_id = current_user_id and bucket < current_bucket - interval '24 hours';
  insert into public.api_usage (user_id, action, bucket, requests)
    values (current_user_id, action_name, current_bucket, 1)
    on conflict (user_id, action, bucket) do update set requests = public.api_usage.requests + 1
    returning requests into current_requests;
  return current_requests <= max_requests;
end;
$$;
revoke all on function public.consume_api_quota(text) from public;
grant execute on function public.consume_api_quota(text) to authenticated;

revoke all on public.users, public.inventories, public.suppliers, public.recipes from anon;
grant select, update on public.users to authenticated;
grant select, insert, update, delete on public.inventories, public.suppliers, public.recipes to authenticated;