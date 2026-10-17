-- Platform-admin reconciliation (migration 52): no obsolete org_members checks remain, every platform-admin entry
-- point needs a platform_admins row AND an aal2 session, ordinary users are denied, and the single audit table is
-- written by the functions that used to write to platform_audit_log.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(45);

create or replace function pg_temp.as_user(uid text, aal text default null) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', aal)::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('92000000-0000-4000-8000-000000000001', 'pa2@example.invalid', now()),  -- platform admin
  ('92000000-0000-4000-8000-000000000002', 'ord2@example.invalid', now()); -- ordinary user

set local bylawiq.operator = 'pgtap-operator';
set local bylawiq.reason = 'Fixture grant for the reconciliation suite';
insert into public.platform_admins (user_id) values ('92000000-0000-4000-8000-000000000001');
reset bylawiq.operator;
reset bylawiq.reason;

insert into public.feature_flags (flag_name, enabled) values ('pgtap_flag', false) on conflict (flag_name) do nothing;

-- Static: no policy or function still checks org_members for the platform_admin role.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'org_members'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '''platform_admin'''),
  0,
  'no public policy checks org_members for platform_admin');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosrc ~ 'org_members' and p.prosrc ~ '''platform_admin'''),
  0,
  'no public or private function checks org_members for platform_admin');

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'platform_audit_log'),
  0,
  'the legacy platform_audit_log table has no client policy');

select ok(
  not has_table_privilege('authenticated', 'public.platform_audit_log', 'select'),
  'authenticated has no select grant on the legacy platform_audit_log');

-- Platform admin with aal2 is admitted.
select pg_temp.as_user('92000000-0000-4000-8000-000000000001', 'aal2');
set local role authenticated;
select ok(public.is_platform_admin(), 'platform admin with aal2 passes is_platform_admin()');
select is(public.get_flag('pgtap_flag'), false, 'platform admin with aal2 reads a feature flag');
select lives_ok($$select * from public.get_audit_logs(5)$$, 'platform admin with aal2 reads the audit log');
select lives_ok($$select * from public.get_all_regions()$$, 'platform admin with aal2 lists regions');
reset role;

-- Platform admin without aal2 is refused by every entry point.
select pg_temp.as_user('92000000-0000-4000-8000-000000000001', 'aal1');
set local role authenticated;
select ok(not public.is_platform_admin(), 'platform admin with aal1 fails is_platform_admin()');
select throws_ok($$select public.get_flag('pgtap_flag')$$, '42501', 'Not a platform admin', 'get_flag refuses aal1');
select throws_ok($$select * from public.get_audit_logs(5)$$, '42501', 'Not a platform admin', 'get_audit_logs refuses aal1');
select throws_ok($$select * from public.get_all_regions()$$, '42501', 'Not a platform admin', 'get_all_regions refuses aal1');
select throws_ok($$select public.set_flag('pgtap_flag', true)$$, '42501', 'Not a platform admin', 'set_flag refuses aal1');
reset role;

-- Ordinary user, even with aal2, is refused.
select pg_temp.as_user('92000000-0000-4000-8000-000000000002', 'aal2');
set local role authenticated;
select throws_ok($$select * from public.get_audit_logs(5)$$, '42501', 'Not a platform admin', 'get_audit_logs refuses an ordinary user');
select throws_ok($$select public.get_flag('pgtap_flag')$$, '42501', 'Not a platform admin', 'get_flag refuses an ordinary user');
select is((select count(*)::int from public.platform_admin_audit), 0, 'an ordinary user reads no platform audit rows');
select is((select count(*)::int from public.resident_audit_log), 0, 'an ordinary user reads no resident audit rows');
reset role;

-- Audit consolidation: the functions write to platform_admin_audit, and only aal2 admins can write.
select pg_temp.as_user('92000000-0000-4000-8000-000000000001', 'aal2');
set local role authenticated;
select lives_ok($$select public.log_admin_action('pgtap_action', 'feature_flag', null, 'pgtap_flag', '{}'::jsonb)$$,
  'platform admin with aal2 writes an audit row through log_admin_action');
select is(
  (select count(*)::int from public.platform_admin_audit
    where action = 'pgtap_action' and details ->> 'resource_name' = 'pgtap_flag'),
  1,
  'the audit row lands in platform_admin_audit with the resource name in details');
select throws_ok($$select public.break_glass_read_document('92000000-0000-4000-8000-0000000000ff'::uuid)$$, 'P0002', 'Document not found', 'break-glass refuses a missing document after the admin check');
reset role;

-- Direct insert into the audit table by an admin without aal2 is refused by RLS.
select pg_temp.as_user('92000000-0000-4000-8000-000000000001', 'aal1');
set local role authenticated;
select throws_ok(
  $$insert into public.platform_admin_audit (admin_id, action, resource_type) values ('92000000-0000-4000-8000-000000000001', 'forged', 'x')$$,
  '42501', null, 'audit append without aal2 is refused by RLS');
reset role;

-- Forging another admin's id in the audit table is refused by RLS.
select pg_temp.as_user('92000000-0000-4000-8000-000000000001', 'aal2');
set local role authenticated;
select throws_ok(
  $$insert into public.platform_admin_audit (admin_id, action, resource_type) values ('92000000-0000-4000-8000-000000000002', 'forged', 'x')$$,
  '42501', null, 'audit append cannot name another admin');
reset role;

-- Every replaced policy now calls is_platform_admin() (the 11 that replaced org_members checks; the legacy
-- platform_audit_read policy is dropped).
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and policyname in ('building_regions_platform_admin_read', 'building_regions_platform_admin_write',
        'intent_classifications_admin_update', 'intent_classifications_admin_write',
        'onboarding_admin_insert', 'onboarding_admin_read', 'onboarding_admin_write',
        'regional_kb_platform_admin_read', 'regional_kb_platform_admin_write',
        'resident_audit_admin_read', 'security_events_admin_access')
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'is_platform_admin'),
  11,
  'all 11 replaced policies call is_platform_admin()');

-- Admin with aal2: every replaced function passes its check.
select pg_temp.as_user('92000000-0000-4000-8000-000000000001', 'aal2');
set local role authenticated;
select throws_ok($$select * from public.search_regional_kb('00000000-0000-0000-0000-000000000000'::uuid, 'lease')$$,
  'P0002', 'Region not found', 'search_regional_kb passes the admin check at aal2');
select lives_ok($$select * from public.search_universal_kb('lease')$$, 'search_universal_kb passes the admin check at aal2');
select lives_ok($$select * from public.get_region_stats('00000000-0000-0000-0000-000000000000'::uuid)$$, 'get_region_stats passes the admin check at aal2');
select lives_ok($$select public.start_onboarding('pgtap firm', 'management')$$, 'start_onboarding passes the admin check at aal2');
select lives_ok($$select public.set_flag('pgtap_flag', true)$$, 'set_flag passes the admin check at aal2');
select ok((select count(*) from public.platform_admin_audit) > 0, 'admin with aal2 sees audit rows through RLS');
reset role;

-- Admin without aal2: every replaced function refuses, and the audit table shows no rows.
select pg_temp.as_user('92000000-0000-4000-8000-000000000001', 'aal1');
set local role authenticated;
select throws_ok($$select * from public.search_regional_kb('00000000-0000-0000-0000-000000000000'::uuid, 'lease')$$,
  '42501', 'Not a platform admin', 'search_regional_kb refuses aal1');
select throws_ok($$select * from public.search_universal_kb('lease')$$, '42501', 'Not a platform admin', 'search_universal_kb refuses aal1');
select throws_ok($$select * from public.get_region_stats('00000000-0000-0000-0000-000000000000'::uuid)$$, '42501', 'Not a platform admin', 'get_region_stats refuses aal1');
select throws_ok($$select public.start_onboarding('pgtap firm', 'management')$$, '42501', 'Not a platform admin', 'start_onboarding refuses aal1');
select throws_ok($$select public.break_glass_read_document('00000000-0000-0000-0000-0000000000ff'::uuid)$$, '42501', 'Not a platform admin', 'break_glass_read_document refuses aal1');
select throws_ok($$select public.log_admin_action('pgtap_action', 'feature_flag', null, 'pgtap_flag', '{}'::jsonb)$$, '42501', 'Not a platform admin', 'log_admin_action refuses aal1');
select is((select count(*)::int from public.platform_admin_audit), 0, 'admin with aal1 sees no audit rows through RLS');
reset role;

-- Ordinary user with aal2: every replaced function refuses.
select pg_temp.as_user('92000000-0000-4000-8000-000000000002', 'aal2');
set local role authenticated;
select throws_ok($$select * from public.search_regional_kb('00000000-0000-0000-0000-000000000000'::uuid, 'lease')$$, '42501', 'Not a platform admin', 'search_regional_kb refuses an ordinary user');
select throws_ok($$select * from public.search_universal_kb('lease')$$, '42501', 'Not a platform admin', 'search_universal_kb refuses an ordinary user');
select throws_ok($$select * from public.get_region_stats('00000000-0000-0000-0000-000000000000'::uuid)$$, '42501', 'Not a platform admin', 'get_region_stats refuses an ordinary user');
select throws_ok($$select public.start_onboarding('pgtap firm', 'management')$$, '42501', 'Not a platform admin', 'start_onboarding refuses an ordinary user');
select throws_ok($$select public.break_glass_read_document('00000000-0000-0000-0000-0000000000ff'::uuid)$$, '42501', 'Not a platform admin', 'break_glass_read_document refuses an ordinary user');
select throws_ok($$select public.set_flag('pgtap_flag', true)$$, '42501', 'Not a platform admin', 'set_flag refuses an ordinary user at aal2');
reset role;

-- platform_admin_status: the admin screens can tell "not an admin" from "admin without MFA on this session".
select pg_temp.as_user('92000000-0000-4000-8000-000000000001', 'aal1');
set local role authenticated;
select results_eq($$select is_platform_admin, mfa_verified from public.platform_admin_status()$$, $$values (true, false)$$, 'admin with aal1 reports admin without MFA');
reset role;
select pg_temp.as_user('92000000-0000-4000-8000-000000000001', 'aal2');
set local role authenticated;
select results_eq($$select is_platform_admin, mfa_verified from public.platform_admin_status()$$, $$values (true, true)$$, 'admin with aal2 reports admin with MFA');
reset role;
select pg_temp.as_user('92000000-0000-4000-8000-000000000002', 'aal2');
set local role authenticated;
select results_eq($$select is_platform_admin, mfa_verified from public.platform_admin_status()$$, $$values (false, true)$$, 'ordinary user reports not an admin, even with aal2');
reset role;

select * from finish();
rollback;
