-- supabase/migrations/20261051000067_firm_onboarding_reconciliation.sql
-- Reconcile Firm Onboarding Engine with platform_admins and buildings schema

-- 1. Update log_admin_action to use is_platform_admin()
create or replace function public.log_admin_action(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_resource_name text,
  p_details jsonb
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_log_id uuid;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  insert into public.platform_audit_log (
    admin_id,
    action,
    resource_type,
    resource_id,
    resource_name,
    details
  ) values (
    (select auth.uid()),
    p_action,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_details
  )
  returning id into v_log_id;

  return v_log_id;
end; $$;

-- 2. Update RLS policies on platform_audit_log
drop policy if exists platform_audit_read on public.platform_audit_log;
create policy platform_audit_read on public.platform_audit_log
  for select to authenticated
  using (public.is_platform_admin());

-- 3. Update RLS policies on onboarding tables
drop policy if exists onboarding_admin_read on public.onboarding_workflows;
create policy onboarding_admin_read on public.onboarding_workflows
  for select to authenticated
  using (admin_id = auth.uid() and public.is_platform_admin());

drop policy if exists onboarding_admin_write on public.onboarding_workflows;
create policy onboarding_admin_write on public.onboarding_workflows
  for update to authenticated
  using (admin_id = auth.uid() and public.is_platform_admin());

drop policy if exists onboarding_admin_insert on public.onboarding_workflows;
create policy onboarding_admin_insert on public.onboarding_workflows
  for insert to authenticated
  with check (admin_id = auth.uid() and public.is_platform_admin());

drop policy if exists onboarding_buildings_read on public.onboarding_buildings;
create policy onboarding_buildings_read on public.onboarding_buildings
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists onboarding_team_members_read on public.onboarding_team_members;
create policy onboarding_team_members_read on public.onboarding_team_members
  for select to authenticated
  using (public.is_platform_admin());

-- 4. Reconcile onboarding_add_building to valid buildings columns
create or replace function public.onboarding_add_building(
  p_workflow_id uuid,
  p_building_name text,
  p_jurisdiction text,
  p_resident_count int
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_building_id uuid;
  v_org_id uuid;
  v_jurisdiction_id uuid;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  select org_id into v_org_id from public.onboarding_workflows
  where id = p_workflow_id and admin_id = (select auth.uid());

  if v_org_id is null then
    raise insufficient_privilege using message = 'Not authorized for this workflow';
  end if;

  select id into v_jurisdiction_id from public.jurisdictions
  where code = p_jurisdiction or name = p_jurisdiction limit 1;

  if v_jurisdiction_id is null then
    select id into v_jurisdiction_id from public.jurisdictions
    where code = 'BC' limit 1;
  end if;

  -- Create building with valid schema columns
  insert into public.buildings (
    name,
    org_id,
    region,
    jurisdiction_chain,
    unit_count,
    corpus_version
  ) values (
    p_building_name,
    v_org_id,
    coalesce(p_jurisdiction, 'BC'),
    case when v_jurisdiction_id is not null then array[v_jurisdiction_id] else '{}'::uuid[] end,
    coalesce(p_resident_count, 1),
    1
  )
  returning id into v_building_id;

  -- Link building to firm organization
  insert into public.firm_building_links (
    building_id,
    firm_org_id,
    status,
    accepted_at
  ) values (
    v_building_id,
    v_org_id,
    'active',
    now()
  );

  -- Record in onboarding
  insert into public.onboarding_buildings (workflow_id, building_name, jurisdiction, resident_count)
  values (p_workflow_id, p_building_name, p_jurisdiction, p_resident_count);

  -- Log action
  perform public.log_admin_action(
    'onboarding_building_added',
    'building',
    v_building_id,
    p_building_name,
    jsonb_build_object('workflow_id', p_workflow_id)
  );

  return v_building_id;
end; $$;

-- 5. Reconcile onboarding_add_team_member
create or replace function public.onboarding_add_team_member(
  p_workflow_id uuid,
  p_email text,
  p_role public.app_role
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_member_id uuid;
  v_org_id uuid;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  select org_id into v_org_id from public.onboarding_workflows
  where id = p_workflow_id and admin_id = (select auth.uid());

  if v_org_id is null then
    raise insufficient_privilege using message = 'Not authorized for this workflow';
  end if;

  if p_role not in ('org_owner', 'org_admin', 'portfolio_manager', 'portfolio_assistant') then
    raise invalid_parameter_value using message = 'Invalid role for firm onboarding';
  end if;

  insert into public.onboarding_team_members (workflow_id, email, role)
  values (p_workflow_id, p_email, p_role)
  returning id into v_member_id;

  perform public.log_admin_action(
    'onboarding_team_member_added',
    'user',
    null,
    p_email,
    jsonb_build_object('workflow_id', p_workflow_id, 'role', p_role::text)
  );

  return v_member_id;
end; $$;

-- 6. Reconcile complete_onboarding
create or replace function public.complete_onboarding(p_workflow_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_org_id uuid;
  v_rec record;
  v_user_id uuid;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  select org_id into v_org_id from public.onboarding_workflows
  where id = p_workflow_id and admin_id = (select auth.uid());

  if v_org_id is null then
    raise insufficient_privilege using message = 'Not authorized for this workflow';
  end if;

  -- Add any registered team members to org_members
  for v_rec in select * from public.onboarding_team_members where workflow_id = p_workflow_id loop
    select id into v_user_id from auth.users where email = v_rec.email limit 1;
    if v_user_id is not null then
      insert into public.org_members (org_id, user_id, role, status)
      values (v_org_id, v_user_id, v_rec.role, 'active')
      on conflict (org_id, user_id) do update set role = excluded.role, status = 'active';
    end if;
  end loop;

  update public.onboarding_workflows
  set status = 'completed', step = 5, completed_at = now()
  where id = p_workflow_id;

  perform public.log_admin_action(
    'onboarding_completed',
    'organization',
    v_org_id,
    null,
    jsonb_build_object('workflow_id', p_workflow_id)
  );

  return true;
end; $$;

grant execute on function public.log_admin_action to authenticated;
grant execute on function public.onboarding_add_building to authenticated;
grant execute on function public.onboarding_add_team_member to authenticated;
grant execute on function public.complete_onboarding to authenticated;
