-- Resident activity audit log
-- Tracks all resident questions, answers, and verification events

create table public.resident_audit_log (
  id bigint generated always as identity primary key,
  building_id uuid not null references public.buildings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('resident_question','resident_answer','verification_failed','rate_limit_hit')),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index resident_audit_building_idx on public.resident_audit_log(building_id, created_at desc);
create index resident_audit_user_idx on public.resident_audit_log(user_id, created_at desc);
create index resident_audit_action_idx on public.resident_audit_log(action, created_at desc);

-- RLS: Residents can only see their own audit logs
alter table public.resident_audit_log enable row level security;

create policy resident_audit_own_read on public.resident_audit_log
  for select to authenticated
  using(
    user_id = auth.uid()
    and exists(
      select 1 from public.building_members bm
      where bm.user_id = auth.uid()
      and bm.building_id = resident_audit_log.building_id
      and bm.role = 'owner_resident'
      and bm.status = 'active'
    )
  );

-- Platform admin can read all audit logs
create policy resident_audit_admin_read on public.resident_audit_log
  for select to authenticated
  using(
    exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

grant select on table public.resident_audit_log to authenticated;
