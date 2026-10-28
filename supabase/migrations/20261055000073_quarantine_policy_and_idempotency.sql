-- Migration 73: Correct quarantine log RLS policy and enforce idempotency
-- 1. Scopes read access to platform administrators via public.is_platform_admin()
-- 2. Adds unique constraint on (source_id, reason) so on conflict do nothing is idempotent

-- Add unique constraint on (source_id, reason)
alter table public.legal_sources_quarantine_log
  drop constraint if exists legal_sources_quarantine_log_source_reason_uniq;
alter table public.legal_sources_quarantine_log
  add constraint legal_sources_quarantine_log_source_reason_uniq unique (source_id, reason);

-- Drop previous policy with dead branch and excessive role exposure
drop policy if exists "quarantine_log_read_policy" on public.legal_sources_quarantine_log;

-- Re-create policy strictly checking platform admin privilege
create policy "quarantine_log_read_policy" on public.legal_sources_quarantine_log
  for select to authenticated
  using (public.is_platform_admin());

grant select on public.legal_sources_quarantine_log to authenticated;
