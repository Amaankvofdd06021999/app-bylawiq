-- Firm owner's view of the firm: its building links and its team. Both functions return rows only when the caller is an
-- active owner or admin of that firm, so the roster and the team are scoped in the database, not in the app.
--
-- Rollback: drop function public.firm_roster(uuid); drop function public.firm_team(uuid);

create or replace function public.firm_roster(p_org uuid)
returns table(building_id uuid, building_name text, link_status text, linked_at timestamptz)
language sql
stable
security definer
set search_path to ''
as $$
  select l.building_id, b.name, l.status, coalesce(l.accepted_at, l.created_at)
  from public.firm_building_links l
  join public.buildings b on b.id = l.building_id
  where l.firm_org_id = p_org
    and b.deleted_at is null
    and exists (
      select 1 from public.org_members m
      where m.org_id = p_org and m.user_id = (select auth.uid())
        and m.role in ('org_owner', 'org_admin') and m.status = 'active'
    )
  order by b.name;
$$;

create or replace function public.firm_team(p_org uuid)
returns table(user_id uuid, role text, display_name text, status text)
language sql
stable
security definer
set search_path to ''
as $$
  select m.user_id, m.role::text, coalesce(p.display_name, ''), m.status
  from public.org_members m
  left join public.profiles p on p.id = m.user_id
  where m.org_id = p_org
    and exists (
      select 1 from public.org_members me
      where me.org_id = p_org and me.user_id = (select auth.uid())
        and me.role in ('org_owner', 'org_admin') and me.status = 'active'
    )
  order by coalesce(p.display_name, ''), m.user_id;
$$;

revoke all on function public.firm_roster(uuid) from public, anon;
revoke all on function public.firm_team(uuid) from public, anon;
grant execute on function public.firm_roster(uuid) to authenticated;
grant execute on function public.firm_team(uuid) to authenticated;
