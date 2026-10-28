-- Migration 72: Quarantine Archive & Data Auditability Log
-- Provides an immutable audit trail and historical rollback capability for legal sources quarantined prior to counsel verification.

create table if not exists public.legal_sources_quarantine_log (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.legal_sources(id) on delete cascade,
  kb_id text,
  kb_version text,
  quarantined_status text not null,
  quarantined_at timestamptz not null default now(),
  reason text not null
);

-- RLS
alter table public.legal_sources_quarantine_log enable row level security;

-- Read policy: platform administrators and authenticated staff can review quarantine audit log
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

-- Populate log with the pre-audit quarantine snapshot
insert into public.legal_sources_quarantine_log (source_id, kb_id, kb_version, quarantined_status, reason)
select id, kb_id, kb_version, status, 'pre_counsel_verification_quarantine'
from public.legal_sources
where status = 'draft'
on conflict do nothing;
