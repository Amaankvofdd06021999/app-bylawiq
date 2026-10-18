-- LTO filing tracking: a filing reference is validated, a filing closes the unfiled notice, another building cannot file, the
-- escalation schedule is applied, and only the service role can refresh the stored severity.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(16);

create or replace function pg_temp.as_user(uid text) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'')::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('9d000000-0000-4000-8000-000000000001', 'lto-manager-t@example.invalid', now()),
  ('9d000000-0000-4000-8000-000000000003', 'lto-other-t@example.invalid', now());

select pg_temp.as_user('9d000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('LTO Strata T', 'single_building', 'LTO Building T', 'Manager T');
select set_config('test.building', (select id::text from public.buildings where name = 'LTO Building T'), true);

select pg_temp.as_user('9d000000-0000-4000-8000-000000000003');
select public.bootstrap_workspace('LTO Other Strata T', 'single_building', 'LTO Other Building T', 'Other T');

-- Adopt one amendment as the manager: draft, review, propose, vote (3 for, 0 against), adopt.
select pg_temp.as_user('9d000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.save_bylaw(current_setting('test.building')::uuid, null, 'Quiet hours', '4.1', 'Quiet hours run from 10 pm to 7 am.', 'Test');
reset role;
select set_config('test.version', (select id::text from public.bylaw_versions where building_id = current_setting('test.building')::uuid order by created_at desc limit 1), true);
set local role authenticated;
select public.transition_bylaw(current_setting('test.version')::uuid, 'in_review');
select public.transition_bylaw(current_setting('test.version')::uuid, 'proposed', 'counsel');
select public.transition_bylaw(current_setting('test.version')::uuid, 'voted', null, null, null, 3, 0, 0);
select public.transition_bylaw(current_setting('test.version')::uuid, 'adopted');
reset role;

-- 1-4. Refusals while the bylaw is only adopted.
set local role authenticated;
select throws_ok(format($$select public.transition_bylaw(%L::uuid, 'filed', null, 'AB', current_date)$$, current_setting('test.version')::uuid),
  'P0001', 'invalid_filing_reference', 'a two-character reference is refused');
select throws_ok(format($$select public.transition_bylaw(%L::uuid, 'filed', null, 'ABCDEF', current_date)$$, current_setting('test.version')::uuid),
  'P0001', 'invalid_filing_reference', 'a reference with no digit is refused');
select throws_ok(format($$select public.transition_bylaw(%L::uuid, 'filed', null, 'LTO 2026', current_date)$$, current_setting('test.version')::uuid),
  'P0001', 'invalid_filing_reference', 'a reference with a space is refused');
select throws_ok(format($$select public.transition_bylaw(%L::uuid, 'filed', null, 'LTO-2026/1234', null)$$, current_setting('test.version')::uuid),
  'P0001', 'effective_date_required', 'a filing without an effective date is refused');
reset role;

-- 5. Another building's manager cannot file this building's bylaw.
select pg_temp.as_user('9d000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok(format($$select public.transition_bylaw(%L::uuid, 'filed', null, 'LTO-2026/1234', current_date)$$, current_setting('test.version')::uuid),
  'P0001', 'forbidden', 'another building''s manager cannot record the filing');
reset role;

-- 6-8. A valid filing is recorded: the status is persisted, the reference is stored trimmed, and the notice closes.
select pg_temp.as_user('9d000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.transition_bylaw(current_setting('test.version')::uuid, 'filed', null, '  LTO-2026/1234 ', current_date);
reset role;
select is((select status from public.bylaw_versions where id = current_setting('test.version')::uuid), 'filed',
  'a valid filing persists the filed status');
select is((select filing_reference from public.bylaw_versions where id = current_setting('test.version')::uuid), 'LTO-2026/1234',
  'the stored reference is the trimmed one');
select is((select state from public.notifications where target_id = current_setting('test.version')::uuid and type = 'unfiled_adoption'), 'actioned',
  'recording the filing closes the unfiled notice');

-- 9-11. The escalation schedule: info before 14 days, warning from 14 days, critical from 60 days.
select is(public.unfiled_notice_severity(now() - interval '1 day'), 'info', 'a notice one day old is info');
select is(public.unfiled_notice_severity(now() - interval '14 days'), 'warning', 'a notice 14 days old is warning');
select is(public.unfiled_notice_severity(now() - interval '60 days'), 'critical', 'a notice 60 days old is critical');

-- 12-13. The stored severity is refreshed for open notices only.
insert into public.notifications (building_id, type, title, body, severity, state, created_at, dedupe_key)
values (current_setting('test.building')::uuid, 'unfiled_adoption', 'Filing record needed', 'Old open notice.', 'info', 'new', now() - interval '20 days', 'lto-open-old');
insert into public.notifications (building_id, type, title, body, severity, state, created_at, dedupe_key)
values (current_setting('test.building')::uuid, 'unfiled_adoption', 'Filing record needed', 'Old closed notice.', 'info', 'actioned', now() - interval '70 days', 'lto-closed-old');
select ok(public.refresh_unfiled_notice_severity() >= 1, 'the refresh changes at least the open notice');
select is((select severity from public.notifications where dedupe_key = 'lto-open-old'), 'warning',
  'an open notice aged 20 days is escalated to warning');
select is((select severity from public.notifications where dedupe_key = 'lto-closed-old'), 'info',
  'a closed notice keeps its severity when refreshed');

-- 14. Ordinary users cannot run the refresh.
select pg_temp.as_user('9d000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok('select public.refresh_unfiled_notice_severity()', '42501', null,
  'an authenticated user cannot run the escalation refresh');
reset role;

-- 15. Another building cannot read this building's notices.
select pg_temp.as_user('9d000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.notifications where building_id = current_setting('test.building')::uuid), 0,
  'another building''s manager reads none of this building''s notices');
reset role;

select * from finish();
rollback;
