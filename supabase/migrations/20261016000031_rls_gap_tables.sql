-- Row level security for tables that were created without it (AGENTS.md: RLS on every table).
-- Rollback: drop the policies created here, then `alter table ... disable row level security;` for each table.

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_members m
    where m.user_id = (select auth.uid())
      and m.role = 'platform_admin'::public.app_role
      and m.status = 'active'
  );
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

alter table public.feature_flags enable row level security;
create policy feature_flags_read on public.feature_flags
  for select to authenticated using (true);
create policy feature_flags_admin_write on public.feature_flags
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table public.regional_kbs enable row level security;
create policy regional_kbs_admin on public.regional_kbs
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table public.kb_passages enable row level security;
create policy kb_passages_admin on public.kb_passages
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table public.platform_admin_audit enable row level security;
create index if not exists platform_admin_audit_admin_idx on public.platform_admin_audit(admin_id, created_at desc);
create policy platform_admin_audit_read on public.platform_admin_audit
  for select to authenticated
  using (public.is_platform_admin());
create policy platform_admin_audit_append on public.platform_admin_audit
  for insert to authenticated
  with check (public.is_platform_admin() and admin_id = (select auth.uid()));

alter table public.firm_onboardings enable row level security;
create index if not exists firm_onboardings_initiated_idx on public.firm_onboardings(initiated_by);
create policy firm_onboardings_initiator on public.firm_onboardings
  for all to authenticated
  using (initiated_by = (select auth.uid()) or public.is_platform_admin())
  with check (initiated_by = (select auth.uid()) or public.is_platform_admin());

alter table public.onboarding_buildings enable row level security;
create index if not exists onboarding_buildings_workflow_idx on public.onboarding_buildings(workflow_id);
create policy onboarding_buildings_admin on public.onboarding_buildings
  for all to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.onboarding_workflows w
      where w.id = workflow_id and w.admin_id = (select auth.uid())
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1 from public.onboarding_workflows w
      where w.id = workflow_id and w.admin_id = (select auth.uid())
    )
  );

alter table public.onboarding_team_members enable row level security;
create index if not exists onboarding_team_members_workflow_idx on public.onboarding_team_members(workflow_id);
create policy onboarding_team_members_admin on public.onboarding_team_members
  for all to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.onboarding_workflows w
      where w.id = workflow_id and w.admin_id = (select auth.uid())
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1 from public.onboarding_workflows w
      where w.id = workflow_id and w.admin_id = (select auth.uid())
    )
  );
