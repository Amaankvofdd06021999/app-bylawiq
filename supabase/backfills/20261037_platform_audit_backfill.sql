-- BACKFILL, NOT APPLIED. Copies historical public.platform_audit_log rows into the canonical public.platform_admin_audit
-- (migration 52). Requires separate written approval per environment. Never part of supabase/migrations, so
-- `supabase db reset` does not run it.
--
-- Target: the environment named in the approval (local first, then staging, then hosted production only with approval).
-- Keep the source table in place. Nothing here deletes or updates platform_audit_log.
--
-- ---------------------------------------------------------------------------
-- 1. PREVIEW (read-only; run first, record the numbers in the approval)
-- ---------------------------------------------------------------------------
select count(*) as source_rows from public.platform_audit_log;
select count(*) as already_copied
from public.platform_audit_log p
where exists (select 1 from public.platform_admin_audit a where a.id = p.id);
select count(*) as to_copy
from public.platform_audit_log p
where not exists (select 1 from public.platform_admin_audit a where a.id = p.id);
select count(*) as target_rows_before from public.platform_admin_audit;
-- Source rows whose admin is no longer in platform_admins are still copied, because audit history must survive a
-- revoke. Count them so the approver can see them.
select count(*) as copied_for_revoked_admins
from public.platform_audit_log p
where not exists (select 1 from public.platform_admins pa where pa.user_id = p.admin_id);

-- ---------------------------------------------------------------------------
-- 2. BACKFILL (run in one transaction; check the reported count equals to_copy from step 1 before committing)
-- ---------------------------------------------------------------------------
begin;
with copied as (
  insert into public.platform_admin_audit (id, admin_id, action, resource_type, resource_id, details, created_at)
  select
    p.id,
    p.admin_id,
    p.action,
    coalesce(p.resource_type, 'unknown'),
    p.resource_id,
    coalesce(p.details, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'resource_name', p.resource_name,
      'ip_address', host(p.ip_address),
      'user_agent', p.user_agent,
      'source', 'platform_audit_log'
    )),
    p.occurred_at
  from public.platform_audit_log p
  where not exists (select 1 from public.platform_admin_audit a where a.id = p.id)
  on conflict (id) do nothing
  returning id
)
select count(*) as copied_rows from copied;
-- Expect copied_rows = to_copy. If not, ROLLBACK and investigate.
commit;

-- ---------------------------------------------------------------------------
-- 3. VERIFY (read-only, after commit)
-- ---------------------------------------------------------------------------
select count(*) as target_rows_after from public.platform_admin_audit;
select count(*) as rows_missing_from_target
from public.platform_audit_log p
where not exists (select 1 from public.platform_admin_audit a where a.id = p.id);  -- expect 0

-- ---------------------------------------------------------------------------
-- ROLLBACK (only if the backfill must be undone; removes only rows this backfill added)
-- ---------------------------------------------------------------------------
-- begin;
-- delete from public.platform_admin_audit
--  where details ->> 'source' = 'platform_audit_log'
--    and id in (select id from public.platform_audit_log);
-- -- Expect the number of deleted rows to equal copied_rows from step 2.
-- commit;
--
-- Caveat: rows that already carried a 'source' key of 'platform_audit_log' from another write would also be removed. None
-- exist today, because no application code writes that key. Check before rolling back.
