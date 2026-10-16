-- supabase/migrations/20261014_onboarding_system.sql
-- Phase 5: Firm Onboarding Workflow
-- Multi-step onboarding wizard for platform admin to set up new firms

create table public.onboarding_workflows (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  step int not null default 1 check(step between 1 and 5),
  status text not null default 'in_progress' check(status in ('in_progress', 'completed', 'cancelled')),
  firm_data jsonb not null default '{}', -- Accumulated form data
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index onboarding_workflows_admin_idx on public.onboarding_workflows(admin_id, created_at desc);
create index onboarding_workflows_org_idx on public.onboarding_workflows(org_id);
create index onboarding_workflows_status_idx on public.onboarding_workflows(status);

-- RLS: Only platform admin can see their own workflows
alter table public.onboarding_workflows enable row level security;

create policy onboarding_admin_read on public.onboarding_workflows
  for select to authenticated
  using(
    admin_id = auth.uid() and exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

create policy onboarding_admin_write on public.onboarding_workflows
  for update to authenticated
  using(
    admin_id = auth.uid() and exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

create policy onboarding_admin_insert on public.onboarding_workflows
  for insert to authenticated
  with check(
    auth.uid() = admin_id and exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

-- Onboarding buildings (attached to workflow)
create table public.onboarding_buildings (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.onboarding_workflows(id) on delete cascade,
  building_name text not null,
  jurisdiction text,
  resident_count int,
  council_president_email text,
  building_manager_email text,
  created_at timestamptz not null default now()
);

create index onboarding_buildings_workflow_idx on public.onboarding_buildings(workflow_id);

-- Onboarding team members (to be invited)
create table public.onboarding_team_members (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.onboarding_workflows(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  invited_at timestamptz,
  status text not null default 'pending' check(status in ('pending', 'invited', 'joined')),
  created_at timestamptz not null default now()
);

create index onboarding_team_members_workflow_idx on public.onboarding_team_members(workflow_id);
create index onboarding_team_members_status_idx on public.onboarding_team_members(status);

-- RPC: Start onboarding workflow
create or replace function public.start_onboarding(
  p_firm_name text,
  p_firm_type text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_workflow_id uuid;
  v_org_id uuid;
begin
  -- Verify caller is platform admin
  if not exists(
    select 1 from public.org_members om
    where om.user_id = auth.uid()
    and om.role = 'platform_admin'
    and om.status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  -- Create organization
  insert into public.organizations (name, type)
  values (p_firm_name, p_firm_type)
  returning id into v_org_id;

  -- Create workflow
  insert into public.onboarding_workflows (
    admin_id,
    org_id,
    step,
    firm_data
  ) values (
    auth.uid(),
    v_org_id,
    1,
    jsonb_build_object(
      'firm_name', p_firm_name,
      'firm_type', p_firm_type
    )
  )
  returning id into v_workflow_id;

  -- Log action
  perform public.log_admin_action(
    'onboarding_started',
    'organization',
    v_org_id,
    p_firm_name,
    jsonb_build_object('workflow_id', v_workflow_id)
  );

  return v_workflow_id;
end; $$;

-- RPC: Add building to onboarding
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
begin
  -- Verify admin ownership of workflow
  select org_id into v_org_id from public.onboarding_workflows
  where id = p_workflow_id and admin_id = auth.uid();

  if v_org_id is null then
    raise insufficient_privilege using message = 'Not authorized for this workflow';
  end if;

  -- Create building
  insert into public.buildings (name, jurisdiction, org_id, corpus_version)
  values (p_building_name, p_jurisdiction, v_org_id, 1)
  returning id into v_building_id;

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

-- RPC: Add team member to onboarding
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
  -- Verify admin ownership of workflow
  select org_id into v_org_id from public.onboarding_workflows
  where id = p_workflow_id and admin_id = auth.uid();

  if v_org_id is null then
    raise insufficient_privilege using message = 'Not authorized for this workflow';
  end if;

  -- Validate role (must be org-level, not building-level)
  if p_role not in ('org_owner', 'org_admin', 'portfolio_manager', 'portfolio_assistant') then
    raise invalid_parameter_value using message = 'Invalid role for firm onboarding';
  end if;

  -- Record team member
  insert into public.onboarding_team_members (workflow_id, email, role)
  values (p_workflow_id, p_email, p_role)
  returning id into v_member_id;

  -- Log action
  perform public.log_admin_action(
    'onboarding_team_member_added',
    'user',
    null,
    p_email,
    jsonb_build_object('workflow_id', p_workflow_id, 'role', p_role::text)
  );

  return v_member_id;
end; $$;

-- RPC: Complete onboarding (mark as done)
create or replace function public.complete_onboarding(p_workflow_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_org_id uuid;
begin
  -- Verify admin ownership
  select org_id into v_org_id from public.onboarding_workflows
  where id = p_workflow_id and admin_id = auth.uid();

  if v_org_id is null then
    raise insufficient_privilege using message = 'Not authorized for this workflow';
  end if;

  -- Mark workflow as completed
  update public.onboarding_workflows
  set status = 'completed', step = 5, completed_at = now()
  where id = p_workflow_id;

  -- Log action
  perform public.log_admin_action(
    'onboarding_completed',
    'organization',
    v_org_id,
    null,
    jsonb_build_object('workflow_id', p_workflow_id)
  );

  return true;
end; $$;

grant execute on function public.start_onboarding to authenticated;
grant execute on function public.onboarding_add_building to authenticated;
grant execute on function public.onboarding_add_team_member to authenticated;
grant execute on function public.complete_onboarding to authenticated;
grant select on table public.onboarding_workflows to authenticated;
grant select on table public.onboarding_buildings to authenticated;
grant select on table public.onboarding_team_members to authenticated;
