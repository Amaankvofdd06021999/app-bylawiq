-- Notices, disputes and bylaws: authorization in the database. A building manager with the right permission can read
-- the building's notifications, dismiss one with a reason, log a dispute event and move a bylaw forward. A resident and
-- another building's manager cannot do any of these, and a dismissal without a reason is refused.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(15);

create or replace function pg_temp.as_user(uid text) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'')::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('9a000000-0000-4000-8000-000000000001', 'nd-manager-t@example.invalid', now()),
  ('9a000000-0000-4000-8000-000000000002', 'nd-resident-t@example.invalid', now()),
  ('9a000000-0000-4000-8000-000000000003', 'nd-other-t@example.invalid', now());

select pg_temp.as_user('9a000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('ND Strata T', 'single_building', 'ND Building T', 'Manager T');
select set_config('test.building', (select id::text from public.buildings where name = 'ND Building T'), true);

select pg_temp.as_user('9a000000-0000-4000-8000-000000000003');
select public.bootstrap_workspace('ND Other Strata T', 'single_building', 'ND Other Building T', 'Other T');
select set_config('test.other', (select id::text from public.buildings where name = 'ND Other Building T'), true);

-- Fixtures written as the database owner: a resident of the building, one notification, one dispute, one bylaw draft.
insert into public.building_members (building_id, user_id, role, status)
values (current_setting('test.building')::uuid, '9a000000-0000-4000-8000-000000000002', 'owner_resident', 'active');
insert into public.notifications (building_id, type, title, body, severity, dedupe_key)
values (current_setting('test.building')::uuid, 'unfiled_adoption', 'Filing record needed', 'Record the LTO filing.', 'warning', 'nd-test-1');
insert into public.disputes (id, building_id, reference, title, opened_by)
values ('9a000000-0000-4000-8000-0000000000d1', current_setting('test.building')::uuid, 'ND-1', 'Noise complaint', '9a000000-0000-4000-8000-000000000001');
insert into public.bylaw_sets (id, building_id, title)
values ('9a000000-0000-4000-8000-0000000000b1', current_setting('test.building')::uuid, 'Bylaws ND');
insert into public.bylaw_nodes (id, building_id, set_id, section_ref, title)
values ('9a000000-0000-4000-8000-0000000000b2', current_setting('test.building')::uuid, '9a000000-0000-4000-8000-0000000000b1', '4.1', 'Quiet hours');
insert into public.bylaw_versions (id, building_id, node_id, version, body, status, created_by)
values ('9a000000-0000-4000-8000-0000000000b3', current_setting('test.building')::uuid, '9a000000-0000-4000-8000-0000000000b2', 1, 'Quiet from 10 pm.', 'draft', '9a000000-0000-4000-8000-000000000001');

-- 1. The building's manager reads the building's notifications.
select pg_temp.as_user('9a000000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.notifications where building_id = current_setting('test.building')::uuid), 1,
  'the building manager reads the building notification');
reset role;

-- 2. A resident of the building cannot read its notifications; another building's manager cannot read them either.
select pg_temp.as_user('9a000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.notifications where building_id = current_setting('test.building')::uuid), 0,
  'a resident cannot read the building notifications');
reset role;
select pg_temp.as_user('9a000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.notifications where building_id = current_setting('test.building')::uuid), 0,
  'another building''s manager cannot read these notifications');

-- 3. Changing a notification needs bylaw.adopt on its building: a resident and another building are refused.
select throws_ok(format($$select public.update_notification(%L::uuid, 'dismissed', 'Already handled by the firm')$$,
  (select id from public.notifications where dedupe_key = 'nd-test-1')), 'P0001', 'forbidden',
  'another building''s manager cannot dismiss the notification');
reset role;
select pg_temp.as_user('9a000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok(format($$select public.update_notification(%L::uuid, 'dismissed', 'Resident trying to dismiss')$$,
  (select id from public.notifications where dedupe_key = 'nd-test-1')), 'P0001', 'forbidden',
  'a resident cannot dismiss the notification');
reset role;

-- 4. A dismissal without a reason is refused; a dismissal with a reason is recorded.
select pg_temp.as_user('9a000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format($$select public.update_notification(%L::uuid, 'dismissed', '')$$,
  (select id from public.notifications where dedupe_key = 'nd-test-1')), 'P0001', 'reason_required',
  'a dismissal without a reason is refused');
select lives_ok(format($$select public.update_notification(%L::uuid, 'dismissed', 'Filed with the county last week')$$,
  (select id from public.notifications where dedupe_key = 'nd-test-1')), 'the manager dismisses the notification with a reason');
reset role;
select is((select state from public.notifications where dedupe_key = 'nd-test-1'), 'dismissed',
  'the dismissal is stored');

-- 5. Logging a dispute event: a resident and another building are refused; the manager's event is recorded.
select pg_temp.as_user('9a000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok($$select public.log_dispute_event('9a000000-0000-4000-8000-0000000000d1', 'investigating', now() - interval '1 day', 'Resident tries to log an event', gen_random_uuid())$$,
  'P0001', 'forbidden', 'a resident cannot log a dispute event');
reset role;
select pg_temp.as_user('9a000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok($$select public.log_dispute_event('9a000000-0000-4000-8000-0000000000d1', 'investigating', now() - interval '1 day', 'Other building tries to log', gen_random_uuid())$$,
  'P0001', 'forbidden', 'another building''s manager cannot log a dispute event by direct id');
reset role;
select pg_temp.as_user('9a000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.log_dispute_event('9a000000-0000-4000-8000-0000000000d1', 'not_a_stage', now() - interval '1 day', 'Unknown stage', gen_random_uuid())$$,
  'P0001', null, 'an unknown dispute stage is refused');
select lives_ok($$select public.log_dispute_event('9a000000-0000-4000-8000-0000000000d1', 'investigating', now() - interval '1 day', 'Investigation opened on the complaint', gen_random_uuid())$$,
  'the manager logs a dispute event');
reset role;

-- 6. Moving a bylaw: a resident and another building are refused; the manager moves it to in review.
select pg_temp.as_user('9a000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok($$select public.transition_bylaw('9a000000-0000-4000-8000-0000000000b3', 'in_review')$$,
  'P0001', 'forbidden', 'a resident cannot move a bylaw');
reset role;
select pg_temp.as_user('9a000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok($$select public.transition_bylaw('9a000000-0000-4000-8000-0000000000b3', 'in_review')$$,
  'P0001', 'forbidden', 'another building''s manager cannot move this bylaw by direct id');
reset role;
select pg_temp.as_user('9a000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select public.transition_bylaw('9a000000-0000-4000-8000-0000000000b3', 'in_review')$$,
  'the manager moves the bylaw to in review');
reset role;

select * from finish();
rollback;
