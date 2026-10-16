-- Platform-admin status for the admin screens. Lets a page tell "not a platform admin" apart from "platform admin who
-- has not passed MFA on this session", so the second case can be sent to the MFA step-up screen.
--
-- Returns only the caller's own status. It does not expose the platform_admins table, which stays unreadable to
-- authenticated users.
--
-- Rollback: drop function public.platform_admin_status();

create or replace function public.platform_admin_status()
returns table(is_platform_admin boolean, mfa_verified boolean)
language sql
stable
security definer
set search_path to ''
as $$
  select
    exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())) as is_platform_admin,
    private.mfa_verified() as mfa_verified;
$$;

revoke all on function public.platform_admin_status() from public, anon;
grant execute on function public.platform_admin_status() to authenticated;
