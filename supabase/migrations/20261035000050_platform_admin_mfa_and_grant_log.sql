-- Decisions D4 and D15, and assumption A2 (platform admin is a separate platform-level persona).
--
-- The earlier model stored platform admins as org_members rows with role 'platform_admin', but the identity migration
-- forbids that role on organisation members, so no platform admin could ever be granted. Platform admin now has its own
-- table, public.platform_admins, which is not organisation or building membership.
--
-- 1. platform_admins: one row per platform admin. Not readable or writable by authenticated users; access goes through
--    is_platform_admin() only.
-- 2. private.mfa_verified(): the caller's JWT reports aal2 (Supabase sets aal2 after a verified TOTP challenge).
-- 3. is_platform_admin() requires a platform_admins row AND aal2. set_flag() and get_audit_logs() use it.
-- 4. platform_admin_grant_log: append-only record of grants and revokes. Not readable by authenticated users.
--    A change made outside the app session (the operator procedure) must set two settings in the same transaction:
--      set local bylawiq.operator = '<operator name>';
--      set local bylawiq.reason = '<reason, at least 10 characters>';
--    Without both, the change is refused. A change made from an authenticated session records the caller as operator.
--
-- Rollback: drop the trigger and function, drop platform_admin_grant_log and platform_admins, and recreate the three
-- functions from 20261014000028_platform_audit_system.sql and the earlier set_flag definition (without the aal2 check).

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from public, anon, authenticated;

create or replace function private.mfa_verified() returns boolean
language sql stable set search_path='' as $$
 select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()))
    and private.mfa_verified();
$$;

create or replace function public.set_flag(p_flag_name text, p_enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_platform_admin() then
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

create or replace function public.get_audit_logs(p_limit integer default 50)
returns table(id uuid, admin_name text, action text, resource_type text, resource_name text, occurred_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  -- Verify caller is a platform admin with MFA (decision D15)
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  return query
  select
    pal.id,
    coalesce(p.display_name, 'Unknown') as admin_name,
    pal.action,
    pal.resource_type,
    pal.resource_name,
    pal.occurred_at
  from public.platform_audit_log pal
  left join public.profiles p on p.id = pal.admin_id
  order by pal.occurred_at desc
  limit p_limit;
end; $$;

create table if not exists public.platform_admin_grant_log (
  id bigint generated always as identity primary key,
  action text not null check (action in ('grant','revoke')),
  target_user uuid not null,
  actor text not null,
  reason text not null check (length(trim(reason)) >= 10),
  created_at timestamptz not null default now()
);
alter table public.platform_admin_grant_log enable row level security;
revoke all on table public.platform_admin_grant_log from public, anon, authenticated;

create or replace function private.log_platform_admin_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare act text; target uuid; actor text; reason text;
begin
  if tg_op = 'INSERT' then
    act := 'grant'; target := new.user_id;
  else
    act := 'revoke'; target := old.user_id;
  end if;

  actor := coalesce(nullif(current_setting('bylawiq.operator', true), ''), (select auth.uid())::text);
  reason := nullif(current_setting('bylawiq.reason', true), '');
  if actor is null then raise exception 'platform_admin_change_needs_operator'; end if;
  if reason is null or length(trim(reason)) < 10 then raise exception 'platform_admin_change_needs_reason'; end if;

  insert into public.platform_admin_grant_log(action, target_user, actor, reason) values (act, target, actor, reason);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists platform_admin_change_logged on public.platform_admins;
create trigger platform_admin_change_logged
  after insert or delete on public.platform_admins
  for each row execute function private.log_platform_admin_change();
