-- supabase/migrations/20261051000069_billing_accounts_and_fixes.sql
-- Additive migration: billing_accounts table and reconciliation

-- 1. Create billing_accounts table
create table if not exists public.billing_accounts (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'pilot' check (plan in ('pilot', 'building', 'building_pro', 'strata_manager', 'enterprise')),
  seats int not null default 3 check (seats >= 1),
  launch_discount boolean not null default false,
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  billing_cycle_start timestamptz default now(),
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table public.billing_accounts enable row level security;

-- Policy: Organization members can read their own billing account, platform admins can read all
drop policy if exists billing_accounts_read on public.billing_accounts;
create policy billing_accounts_read on public.billing_accounts
  for select to authenticated
  using (
    public.is_org_member(org_id)
    or public.is_platform_admin()
  );

-- Policy: Org owners and platform admins can update billing accounts
drop policy if exists billing_accounts_update on public.billing_accounts;
create policy billing_accounts_update on public.billing_accounts
  for update to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.org_id = billing_accounts.org_id
        and m.user_id = (select auth.uid())
        and m.role in ('org_owner', 'org_admin')
        and m.status = 'active'
    )
    or public.is_platform_admin()
  );

-- 3. Backfill existing organizations into billing_accounts
insert into public.billing_accounts (org_id, plan, seats, launch_discount, status, created_at)
select 
  o.id,
  coalesce(o.plan, 'pilot'),
  case when o.kind = 'firm' then 5 else 3 end,
  false,
  'active',
  now()
from public.organizations o
on conflict (org_id) do nothing;

-- 4. Grant table access to authenticated users
grant select on public.billing_accounts to authenticated;
grant update on public.billing_accounts to authenticated;
