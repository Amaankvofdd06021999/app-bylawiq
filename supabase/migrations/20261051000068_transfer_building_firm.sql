-- supabase/migrations/20261051000068_transfer_building_firm.sql
-- Building Management Firm Transfer for Platform Admins

-- 1. Policy for platform admins to view firm_building_links
drop policy if exists firm_links_platform_admin on public.firm_building_links;
create policy firm_links_platform_admin on public.firm_building_links
  for select to authenticated
  using (public.is_platform_admin());

-- 2. Atomic transfer function
create or replace function public.transfer_building_firm(
  p_building_id uuid,
  p_target_firm_org_id uuid,
  p_target_manager_user_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_admin_id uuid;
  v_building_name text;
  v_target_firm_name text;
  v_target_kind text;
  v_old_link record;
  v_former_firm_id uuid;
  v_former_firm_name text;
  v_new_link_id uuid;
  v_suspended_members_count int := 0;
begin
  -- Enforce Platform Admin with MFA
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  v_admin_id := (select auth.uid());

  -- Lock building row
  select name into v_building_name from public.buildings
  where id = p_building_id and deleted_at is null
  for update;

  if v_building_name is null then
    raise exception 'Building not found';
  end if;

  -- Validate target firm
  select name, kind into v_target_firm_name, v_target_kind from public.organizations
  where id = p_target_firm_org_id;

  if v_target_firm_name is null or v_target_kind <> 'firm' then
    raise exception 'Target organization is not a valid management firm';
  end if;

  -- Validate optional designated manager
  if p_target_manager_user_id is not null then
    if not exists (
      select 1 from public.org_members
      where org_id = p_target_firm_org_id
        and user_id = p_target_manager_user_id
        and status = 'active'
    ) then
      raise exception 'Designated manager is not an active member of the target firm';
    end if;
  end if;

  -- Check existing active link
  select l.id, l.firm_org_id
  into v_old_link
  from public.firm_building_links l
  where l.building_id = p_building_id and l.status = 'active'
  for update;

  if v_old_link.id is not null then
    if v_old_link.firm_org_id = p_target_firm_org_id then
      raise exception 'Building is already actively managed by this firm';
    end if;

    v_former_firm_id := v_old_link.firm_org_id;
    select name into v_former_firm_name from public.organizations where id = v_former_firm_id;

    -- Revoke existing firm link
    update public.firm_building_links
    set status = 'revoked',
        revoked_by = v_admin_id,
        revoked_at = now()
    where id = v_old_link.id;

    -- Suspend members that accessed building via old link
    with suspended as (
      update public.building_members
      set status = 'suspended'
      where building_id = p_building_id and via_link_id = v_old_link.id
      returning 1
    )
    select count(*) into v_suspended_members_count from suspended;
  end if;

  -- Insert new active link
  insert into public.firm_building_links (
    building_id,
    firm_org_id,
    status,
    accepted_by,
    accepted_at
  ) values (
    p_building_id,
    p_target_firm_org_id,
    'active',
    v_admin_id,
    now()
  )
  returning id into v_new_link_id;

  -- Automatically populate staff memberships for the new firm
  perform private.add_link_members(v_new_link_id);

  -- If designated manager is specified, ensure building_manager role
  if p_target_manager_user_id is not null then
    insert into public.building_members (
      building_id,
      user_id,
      role,
      status,
      via_link_id
    ) values (
      p_building_id,
      p_target_manager_user_id,
      'building_manager'::public.app_role,
      'active',
      v_new_link_id
    )
    on conflict (building_id, user_id) do update set
      role = 'building_manager'::public.app_role,
      status = 'active',
      via_link_id = v_new_link_id,
      expires_at = null;
  end if;

  -- Log action in platform audit log
  perform public.log_admin_action(
    'building.transfer_firm',
    'building',
    p_building_id,
    v_building_name,
    jsonb_build_object(
      'former_firm_org_id', v_former_firm_id,
      'former_firm_name', v_former_firm_name,
      'new_firm_org_id', p_target_firm_org_id,
      'new_firm_name', v_target_firm_name,
      'new_manager_user_id', p_target_manager_user_id,
      'new_link_id', v_new_link_id,
      'suspended_members_count', v_suspended_members_count
    )
  );

  return jsonb_build_object(
    'ok', true,
    'building_id', p_building_id,
    'building_name', v_building_name,
    'former_firm_org_id', v_former_firm_id,
    'former_firm_name', v_former_firm_name,
    'new_firm_org_id', p_target_firm_org_id,
    'new_firm_name', v_target_firm_name,
    'new_link_id', v_new_link_id,
    'suspended_members_count', v_suspended_members_count
  );
end; $$;

-- 3. Query candidates for building transfer
create or replace function public.get_building_transfer_candidates()
returns table (
  building_id uuid,
  building_name text,
  strata_plan_no text,
  unit_count int,
  current_firm_id uuid,
  current_firm_name text,
  link_id uuid,
  linked_since timestamptz
)
language sql stable security definer set search_path='' as $$
  select
    b.id as building_id,
    b.name as building_name,
    b.strata_plan_no,
    b.unit_count,
    l.firm_org_id as current_firm_id,
    o.name as current_firm_name,
    l.id as link_id,
    l.accepted_at as linked_since
  from public.buildings b
  left join public.firm_building_links l on l.building_id = b.id and l.status = 'active'
  left join public.organizations o on o.id = l.firm_org_id
  where b.deleted_at is null
    and public.is_platform_admin()
  order by b.name asc;
$$;

-- 4. Query firm destinations
create or replace function public.get_firm_transfer_destinations()
returns table (
  firm_id uuid,
  firm_name text,
  active_building_count bigint,
  active_member_count bigint
)
language sql stable security definer set search_path='' as $$
  select
    o.id as firm_id,
    o.name as firm_name,
    count(distinct l.building_id) as active_building_count,
    count(distinct m.user_id) as active_member_count
  from public.organizations o
  left join public.firm_building_links l on l.firm_org_id = o.id and l.status = 'active'
  left join public.org_members m on m.org_id = o.id and m.status = 'active'
  where o.kind = 'firm'
    and public.is_platform_admin()
  group by o.id, o.name
  order by o.name asc;
$$;

-- 5. Query active firm managers
create or replace function public.get_firm_managers(p_firm_id uuid)
returns table (
  user_id uuid,
  email text,
  role public.app_role,
  display_name text
)
language sql stable security definer set search_path='' as $$
  select
    m.user_id,
    u.email::text,
    m.role,
    coalesce(p.display_name, u.email::text) as display_name
  from public.org_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.org_id = p_firm_id
    and m.status = 'active'
    and public.is_platform_admin()
  order by coalesce(p.display_name, u.email::text) asc;
$$;

-- 6. Permissions
grant execute on function public.transfer_building_firm(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_building_transfer_candidates() to authenticated;
grant execute on function public.get_firm_transfer_destinations() to authenticated;
grant execute on function public.get_firm_managers(uuid) to authenticated;
