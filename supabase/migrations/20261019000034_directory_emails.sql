-- Emails live in auth.users, which the API cannot embed. This returns them only to callers who already manage or
-- can read the person: themselves, platform admins, org admins of a shared firm, or members with member.read on a
-- building the person belongs to. Rollback: drop function public.directory_emails(uuid[]).

create or replace function public.directory_emails(p_user_ids uuid[])
returns table(user_id uuid, email text, display_name text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, p.display_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = any(p_user_ids)
    and (
      u.id = (select auth.uid())
      or public.is_platform_admin()
      or exists (
        select 1
        from public.org_members mine
        join public.org_members theirs on theirs.org_id = mine.org_id
        where mine.user_id = (select auth.uid())
          and mine.status = 'active'
          and mine.role in ('org_owner', 'org_admin', 'portfolio_manager')
          and theirs.user_id = u.id
      )
      or exists (
        select 1
        from public.building_members bm
        where bm.user_id = u.id
          and bm.status = 'active'
          and public.authorize('member.read', bm.building_id)
      )
    );
$$;

revoke execute on function public.directory_emails(uuid[]) from public, anon;
grant execute on function public.directory_emails(uuid[]) to authenticated;