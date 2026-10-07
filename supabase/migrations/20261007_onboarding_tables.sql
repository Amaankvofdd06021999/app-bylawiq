-- Firm Onboarding workflow tables

-- 1. Firm onboarding progress tracking
create table if not exists public.firm_onboardings (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  step int not null check (step between 1 and 5) default 1,
  firm_name text not null,
  contact_email text not null,
  jurisdiction text not null check (jurisdiction in ('BC', 'AB', 'ON', 'QC', 'MB', 'SK')),
  buildings jsonb default '[]'::jsonb,
  team_members jsonb default '[]'::jsonb,
  billing_email text,
  notification_email text,
  initiated_by uuid not null references auth.users(id),
  completed_by uuid references auth.users(id),
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

comment on table public.firm_onboardings is '5-step onboarding workflow for new strata firms (step 1-5)';
create index idx_firm_onboardings_org on public.firm_onboardings(org_id);
create index idx_firm_onboardings_step on public.firm_onboardings(step);
create index idx_firm_onboardings_created on public.firm_onboardings(created_at desc);

-- 2. Organization assignments (which buildings each strata manager is assigned to)
create table if not exists public.org_assignments (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  assigned_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

comment on table public.org_assignments is 'Which buildings each strata manager/portfolio manager is assigned to manage';
create index idx_org_assignments_org on public.org_assignments(org_id);
create index idx_org_assignments_user on public.org_assignments(user_id);
create index idx_org_assignments_building on public.org_assignments(building_id);
create index idx_org_assignments_deleted on public.org_assignments(deleted_at);

-- Enable RLS on assignments
alter table public.org_assignments enable row level security;

-- RLS: Users can see their own assignments
create policy "Users can see their building assignments"
  on public.org_assignments
  for select
  using (user_id = auth.uid() and deleted_at is null);

-- RLS: Org admins can see all assignments in their org
create policy "Org admins can see org assignments"
  on public.org_assignments
  for select
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid() and role in ('org_owner', 'org_admin') and deleted_at is null
    )
    and deleted_at is null
  );

-- RLS: Only org owner can modify assignments
create policy "Org owner can manage assignments"
  on public.org_assignments
  for insert
  with check (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid() and role = 'org_owner' and deleted_at is null
    )
  );
