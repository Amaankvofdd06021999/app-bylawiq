-- supabase/migrations/20261012_staff_documents.sql
-- Phase 5B: Staff-Only Documents for Building Managers
--
-- Adds three new document types accessible only to building staff:
-- 1. Maintenance logs (repairs, issues, preventive maintenance)
-- 2. Vendor contracts (service providers, terms, costs)
-- 3. Insurance policies (coverage, deductibles, renewal dates)
--
-- Rollback: drop table public.insurance_policies; drop table public.vendor_contracts; drop table public.maintenance_logs;

-- Maintenance logs (building repairs and maintenance history)
-- Vendor contracts (referenced by maintenance_logs)
create table public.vendor_contracts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,

  -- Vendor details
  vendor_name text not null,
  service_type text not null check(service_type in (
    'plumbing', 'electrical', 'hvac', 'cleaning', 'security',
    'landscaping', 'pest_control', 'insurance', 'property_management', 'other'
  )),
  contact_person text,
  contact_email text,
  contact_phone text,

  -- Contract terms
  contract_start_date date not null,
  contract_end_date date not null,
  renewal_reminder_days integer default 30, -- Send reminder X days before expiry

  -- Pricing
  monthly_cost numeric,
  annual_cost numeric,
  pricing_model text, -- "monthly", "annual", "per_incident", etc.

  -- Scope
  service_scope text, -- Description of what's included
  emergency_available boolean default false,
  response_time_hours integer, -- SLA response time

  -- Status
  status text not null default 'active' check(status in ('active', 'inactive', 'expiring', 'expired')),
  auto_renew boolean default false,

  -- Contract document
  contract_document_id uuid references public.documents(id) on delete set null, -- Link to uploaded contract

  -- Metadata
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (contract_end_date > contract_start_date)
);

create table public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,

  -- Issue details
  issue_type text not null check(issue_type in (
    'plumbing', 'electrical', 'hvac', 'structural',
    'exterior', 'common_area', 'roof', 'parking', 'other'
  )),
  description text not null,
  severity text not null check(severity in ('low', 'medium', 'high', 'critical')),

  -- Status tracking
  status text not null default 'reported' check(status in (
    'reported', 'assigned', 'in_progress', 'resolved', 'closed'
  )),

  -- Dates
  reported_at timestamptz not null default now(),
  assigned_at timestamptz,
  resolved_at timestamptz,

  -- Cost tracking
  estimated_cost numeric,
  actual_cost numeric,

  -- Attribution
  reported_by uuid not null references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,

  -- Metadata
  location text, -- "Unit 302, hallway", etc.
  vendor_id uuid references public.vendor_contracts(id) on delete set null,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index maintenance_logs_building_idx on public.maintenance_logs(building_id, reported_at desc);
create index maintenance_logs_status_idx on public.maintenance_logs(building_id, status);
create index maintenance_logs_severity_idx on public.maintenance_logs(building_id, severity);
create index maintenance_logs_type_idx on public.maintenance_logs(building_id, issue_type);


create index vendor_contracts_building_idx on public.vendor_contracts(building_id, service_type);
create index vendor_contracts_status_idx on public.vendor_contracts(building_id, status);
create index vendor_contracts_renewal_idx on public.vendor_contracts(building_id, contract_end_date)
  where status != 'expired';

-- Insurance policies (building insurance)
create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,

  -- Policy details
  policy_type text not null check(policy_type in (
    'property_damage', 'liability', 'directors_and_officers',
    'management_liability', 'crime', 'cyber', 'other'
  )),
  provider_name text not null,
  policy_number text not null unique,

  -- Coverage
  coverage_type text not null, -- "All-risk", "Named-peril", etc.
  coverage_amount numeric not null, -- In dollars
  deductible numeric not null,

  -- Dates
  policy_start_date date not null,
  policy_end_date date not null,
  renewal_reminder_days integer default 60,

  -- Broker/Contact
  broker_name text,
  broker_email text,
  broker_phone text,
  contact_name text, -- Building contact

  -- Premium
  annual_premium numeric,
  payment_frequency text, -- "monthly", "quarterly", "annual"

  -- Status
  status text not null default 'active' check(status in ('active', 'inactive', 'expiring', 'expired')),
  auto_renew boolean default true,

  -- Exclusions and special conditions
  exclusions text, -- List of what's NOT covered
  special_conditions text, -- Any special requirements

  -- Policy document
  policy_document_id uuid references public.documents(id) on delete set null,

  -- Metadata
  last_claim_date date,
  claim_history text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (policy_end_date > policy_start_date)
);

create index insurance_policies_building_idx on public.insurance_policies(building_id, policy_type);
create index insurance_policies_status_idx on public.insurance_policies(building_id, status);
create index insurance_policies_renewal_idx on public.insurance_policies(building_id, policy_end_date)
  where status != 'expired';

-- RLS Policies (Building managers and above only)
alter table public.maintenance_logs enable row level security;
alter table public.vendor_contracts enable row level security;
alter table public.insurance_policies enable row level security;

-- Building managers can read/write maintenance logs
create policy maintenance_logs_read on public.maintenance_logs
  for select to authenticated
  using(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid()
      and role in ('building_manager', 'council_president', 'org_owner', 'org_admin')
      and status = 'active'
    )
  );

create policy maintenance_logs_insert on public.maintenance_logs
  for insert to authenticated
  with check(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid()
      and role in ('building_manager', 'org_owner', 'org_admin')
      and status = 'active'
    )
  );

create policy maintenance_logs_update on public.maintenance_logs
  for update to authenticated
  using(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid()
      and role in ('building_manager', 'org_owner', 'org_admin')
      and status = 'active'
    )
  );

-- Vendor contracts (building managers only)
create policy vendor_contracts_read on public.vendor_contracts
  for select to authenticated
  using(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid()
      and role in ('building_manager', 'council_president', 'org_owner', 'org_admin')
      and status = 'active'
    )
  );

create policy vendor_contracts_insert on public.vendor_contracts
  for insert to authenticated
  with check(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid()
      and role in ('building_manager', 'org_owner', 'org_admin')
      and status = 'active'
    )
  );

create policy vendor_contracts_update on public.vendor_contracts
  for update to authenticated
  using(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid()
      and role in ('building_manager', 'org_owner', 'org_admin')
      and status = 'active'
    )
  );

-- Insurance policies (building managers only)
create policy insurance_policies_read on public.insurance_policies
  for select to authenticated
  using(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid()
      and role in ('building_manager', 'council_president', 'org_owner', 'org_admin')
      and status = 'active'
    )
  );

create policy insurance_policies_insert on public.insurance_policies
  for insert to authenticated
  with check(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid()
      and role in ('building_manager', 'org_owner', 'org_admin')
      and status = 'active'
    )
  );

create policy insurance_policies_update on public.insurance_policies
  for update to authenticated
  using(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid()
      and role in ('building_manager', 'org_owner', 'org_admin')
      and status = 'active'
    )
  );

-- Functions for renewal reminders
create or replace function public.get_expiring_contracts(p_building_id uuid, p_days_ahead int default 30)
returns table(
  vendor_name text,
  contract_end_date date,
  days_until_expiry int,
  service_type text
) language sql stable security definer as $$
  select
    vendor_name,
    contract_end_date,
    (contract_end_date - current_date)::int,
    service_type
  from public.vendor_contracts
  where building_id = p_building_id
    and status != 'expired'
    and contract_end_date <= (current_date + (p_days_ahead || ' days')::interval)
  order by contract_end_date;
$$;

create or replace function public.get_expiring_policies(p_building_id uuid, p_days_ahead int default 60)
returns table(
  provider_name text,
  policy_type text,
  policy_end_date date,
  days_until_expiry int
) language sql stable security definer as $$
  select
    provider_name,
    policy_type,
    policy_end_date,
    (policy_end_date - current_date)::int
  from public.insurance_policies
  where building_id = p_building_id
    and status != 'expired'
    and policy_end_date <= (current_date + (p_days_ahead || ' days')::interval)
  order by policy_end_date;
$$;

grant execute on function public.get_expiring_contracts to authenticated;
grant execute on function public.get_expiring_policies to authenticated;

-- Audit triggers
create trigger audit_maintenance_logs
after insert or update on public.maintenance_logs
for each row
execute function public.audit_change();

create trigger audit_vendor_contracts
after insert or update on public.vendor_contracts
for each row
execute function public.audit_change();

create trigger audit_insurance_policies
after insert or update on public.insurance_policies
for each row
execute function public.audit_change();
