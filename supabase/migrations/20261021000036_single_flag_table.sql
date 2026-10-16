-- One table for platform feature flags. The app reads and writes public.feature_flags; an earlier migration
-- created a second table (platform_flags) that nothing used except two RPCs. Move its rows, seed the flags the app
-- depends on, and point the RPCs at feature_flags. Rollback: recreate platform_flags from feature_flags.

insert into public.feature_flags (flag_name, enabled, description) values
  ('residentAi', true, 'Allow residents to use Ask feature'),
  ('regionalKbs', false, 'Enable regional knowledge bases')
on conflict (flag_name) do nothing;

insert into public.feature_flags (flag_name, enabled, description, updated_by, updated_at)
select flag_name, enabled, description, updated_by, updated_at
from public.platform_flags
on conflict (flag_name) do nothing;

create or replace function public.get_flag(p_flag_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_enabled boolean;
begin
  if not exists(
    select 1 from public.org_members
    where user_id = (select auth.uid()) and role = 'platform_admin' and status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  select enabled into v_enabled from public.feature_flags where flag_name = p_flag_name;
  return coalesce(v_enabled, false);
end; $$;

create or replace function public.set_flag(p_flag_name text, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists(
    select 1 from public.org_members
    where user_id = (select auth.uid()) and role = 'platform_admin' and status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  insert into public.feature_flags (flag_name, enabled, updated_by, updated_at)
  values (p_flag_name, p_enabled, (select auth.uid()), now())
  on conflict (flag_name) do update set
    enabled = excluded.enabled,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  return true;
end; $$;

drop table public.platform_flags;
