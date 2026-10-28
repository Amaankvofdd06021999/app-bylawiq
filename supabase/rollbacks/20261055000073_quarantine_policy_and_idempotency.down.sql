-- Rollback Migration 73: Restore previous quarantine policy and drop unique constraint
drop policy if exists "quarantine_log_read_policy" on public.legal_sources_quarantine_log;

create policy "quarantine_log_read_policy" on public.legal_sources_quarantine_log
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'system_role') in ('platform_admin', 'super_admin')
    or exists (
      select 1 from public.building_members bm
      where bm.user_id = auth.uid()
        and bm.role in ('building_manager'::public.app_role, 'council_president'::public.app_role, 'council_member'::public.app_role)
    )
  );

alter table public.legal_sources_quarantine_log
  drop constraint if exists legal_sources_quarantine_log_source_reason_uniq;
