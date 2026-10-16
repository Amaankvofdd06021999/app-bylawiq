-- supabase/migrations/20261014_platform_admin_core.sql
-- Phase 1-2: Production Console Hardening + Flags Table
-- Adds real platform_flags table and ensures JWT claims are properly validated

-- Platform feature flags (replaces in-memory mock)
create table public.platform_flags (
  id uuid primary key default gen_random_uuid(),
  flag_name text not null unique,
  enabled boolean not null default false,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index platform_flags_name_idx on public.platform_flags(flag_name);

-- RLS: Only platform admin can read/write flags
alter table public.platform_flags enable row level security;

create policy platform_flags_admin_read on public.platform_flags
  for select to authenticated
  using(
    exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

create policy platform_flags_admin_write on public.platform_flags
  for update to authenticated
  using(
    exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

-- RPC: Get a flag by name (platform admin only)
create or replace function public.get_flag(p_flag_name text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_enabled boolean;
begin
  -- Verify caller is platform admin
  if not exists(
    select 1 from public.org_members
    where user_id = auth.uid() and role = 'platform_admin' and status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  select enabled into v_enabled
  from public.platform_flags
  where flag_name = p_flag_name;

  return coalesce(v_enabled, false);
end; $$;

-- RPC: Set a flag (platform admin only)
create or replace function public.set_flag(p_flag_name text, p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  -- Verify caller is platform admin
  if not exists(
    select 1 from public.org_members
    where user_id = auth.uid() and role = 'platform_admin' and status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  insert into public.platform_flags (flag_name, enabled, updated_by, updated_at)
  values (p_flag_name, p_enabled, auth.uid(), now())
  on conflict (flag_name) do update set
    enabled = p_enabled,
    updated_by = auth.uid(),
    updated_at = now();

  return true;
end; $$;

-- Seed initial flags
insert into public.platform_flags (flag_name, enabled, description) values
  ('residentAi', true, 'Allow residents to use Ask feature'),
  ('regionalKbs', false, 'Enable regional knowledge bases')
on conflict (flag_name) do nothing;

grant execute on function public.get_flag to authenticated;
grant execute on function public.set_flag to authenticated;
grant select on table public.platform_flags to authenticated;
