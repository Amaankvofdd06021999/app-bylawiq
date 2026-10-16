-- Decision D1: building managers and council presidents manage resident membership in their own building.
-- can_assign decides which roles a holder may invite or assign. Before this migration, building_manager and
-- council_president could assign only council_member and external_counsel, so a manager could not invite a resident
-- through create_invitation at all.
--
-- Unchanged on purpose:
--   * council_member and external_counsel remain read-only (they cannot assign any role).
--   * create_invitation still refuses linked firm staff from inviting residents (their building role is revocable).
--   * The database still scopes every assignment to the building the caller holds the role in.
--
-- Rollback: recreate public.can_assign from 20260914092517_members_and_retrieval.sql.

create or replace function public.can_assign(p_building uuid, p_role public.app_role) returns boolean
language sql stable security definer set search_path='' as $$
 select case public.my_building_role(p_building)
  when 'org_owner' then p_role not in ('platform_admin','org_owner')
  when 'org_admin' then p_role not in ('platform_admin','org_owner','org_admin')
  when 'portfolio_manager' then p_role in ('portfolio_assistant','building_manager','council_president','council_member','external_counsel','owner_resident')
  when 'building_manager' then p_role in ('owner_resident','council_member','external_counsel')
  when 'council_president' then p_role in ('owner_resident','council_member','external_counsel')
  else false end; $$;
