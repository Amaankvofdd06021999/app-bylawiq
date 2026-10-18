-- Resident notice delivery: an approved notice is queued for each active resident. Managers who may adopt read the status and
-- record outcomes. Residents and other buildings read nothing. Attempts stop at three. Nobody writes a delivery directly.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(23);

create or replace function pg_temp.as_user(uid text) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'')::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('a1000000-0000-4000-8000-000000000001', 'nd-manager-t@example.invalid', now()),
  ('a1000000-0000-4000-8000-000000000002', 'nd-resident-t@example.invalid', now()),
  ('a1000000-0000-4000-8000-000000000003', 'nd-other-t@example.invalid', now());

select pg_temp.as_user('a1000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('ND Strata T', 'single_building', 'ND Building T', 'Manager T');
select set_config('test.building', (select id::text from public.buildings where name = 'ND Building T'), true);
select pg_temp.as_user('a1000000-0000-4000-8000-000000000003');
select public.bootstrap_workspace('ND Other Strata T', 'single_building', 'ND Other Building T', 'Other T');
select set_config('test.other', (select id::text from public.buildings where name = 'ND Other Building T'), true);

insert into public.building_members (building_id, user_id, role, status)
values (current_setting('test.building')::uuid, 'a1000000-0000-4000-8000-000000000002', 'owner_resident', 'active');

-- Two approved notices and one draft, written as the database owner.
insert into public.generated_documents (id, building_id, kind, title, body_md, status, created_by, approved_by, approved_at)
values ('a2000000-0000-4000-8000-000000000001', current_setting('test.building')::uuid, 's135_notice', 'Quiet hours notice', 'Please observe quiet hours.', 'approved',
        'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', now()),
       ('a2000000-0000-4000-8000-000000000002', current_setting('test.building')::uuid, 's135_notice', 'Second notice', 'A second notice.', 'approved',
        'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', now()),
       ('a2000000-0000-4000-8000-000000000003', current_setting('test.building')::uuid, 's135_notice', 'Draft notice', 'Not approved.', 'draft',
        'a1000000-0000-4000-8000-000000000001', null, null);

-- 1-3. The manager queues the approved notice for the one resident; a second call adds nothing; a draft is refused.
select pg_temp.as_user('a1000000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.queue_notice_delivery('a2000000-0000-4000-8000-000000000001'), 1,
  'the manager queues the approved notice for the one resident');
select is(public.queue_notice_delivery('a2000000-0000-4000-8000-000000000001'), 0,
  'queuing the same notice again adds no second delivery');
select throws_ok($$select public.queue_notice_delivery('a2000000-0000-4000-8000-000000000003')$$,
  'P0001', 'notice_not_approved', 'a draft notice is refused');
reset role;

-- 4. A resident cannot queue a notice.
select pg_temp.as_user('a1000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok($$select public.queue_notice_delivery('a2000000-0000-4000-8000-000000000001')$$,
  'P0001', 'forbidden', 'a resident cannot queue a notice');
reset role;

-- 5. Another building's manager cannot queue this building's notice.
select pg_temp.as_user('a1000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok($$select public.queue_notice_delivery('a2000000-0000-4000-8000-000000000001')$$,
  'P0001', 'forbidden', 'another building''s manager cannot queue this notice');
reset role;

-- 6-8. The manager reads the status; the resident and the other building read none.
select pg_temp.as_user('a1000000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.notice_deliveries), 1, 'the manager reads the delivery status');
reset role;
select pg_temp.as_user('a1000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.notice_deliveries), 0, 'a resident reads no delivery records');
reset role;
select pg_temp.as_user('a1000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.notice_deliveries), 0, 'another building''s manager reads no delivery records');
reset role;

-- 9. The manager claims the delivery; claiming counts the attempt.
select pg_temp.as_user('a1000000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.claim_notice_deliveries('a2000000-0000-4000-8000-000000000001', 10)), 1,
  'the manager claims the queued delivery');
reset role;

-- 10. A successful send is recorded.
select pg_temp.as_user('a1000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok(format($$select public.record_notice_delivery_result(%L::uuid, true, null)$$,
  (select id from public.notice_deliveries where notice_id = 'a2000000-0000-4000-8000-000000000001')),
  'the manager records a successful send');
reset role;
select is((select status from public.notice_deliveries where notice_id = 'a2000000-0000-4000-8000-000000000001'), 'sent',
  'a successful send is persisted as sent');

-- 11-13. A failed send is retried, up to three attempts; the error is generic and short.
select pg_temp.as_user('a1000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.queue_notice_delivery('a2000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.claim_notice_deliveries('a2000000-0000-4000-8000-000000000002', 10)), 1,
  'the second notice is claimed for its first attempt');
select lives_ok(format($$select public.record_notice_delivery_result(%L::uuid, false, %L)$$,
  (select id from public.notice_deliveries where notice_id = 'a2000000-0000-4000-8000-000000000002'), repeat('x', 500)),
  'the manager records a failed attempt with a long error');
reset role;
select is((select length(last_error)::int from public.notice_deliveries where notice_id = 'a2000000-0000-4000-8000-000000000002'), 200,
  'the stored error is cut to 200 characters');

-- 12. A failed delivery is retried until the third attempt.
set local role authenticated;
select is((select count(*)::int from public.claim_notice_deliveries('a2000000-0000-4000-8000-000000000002', 10)), 1,
  'a failed delivery is claimed again (attempt 2)');
select lives_ok(format($$select public.record_notice_delivery_result(%L::uuid, false, 'Provider timeout')$$,
  (select id from public.notice_deliveries where notice_id = 'a2000000-0000-4000-8000-000000000002')),
  'the second attempt fails');
select is((select count(*)::int from public.claim_notice_deliveries('a2000000-0000-4000-8000-000000000002', 10)), 1,
  'a failed delivery is claimed a third time (attempt 3)');
select lives_ok(format($$select public.record_notice_delivery_result(%L::uuid, false, 'Provider timeout')$$,
  (select id from public.notice_deliveries where notice_id = 'a2000000-0000-4000-8000-000000000002')),
  'the third attempt fails');
select is((select count(*)::int from public.claim_notice_deliveries('a2000000-0000-4000-8000-000000000002', 10)), 0,
  'after three attempts nothing more is claimed');
reset role;

-- 14-16. Direct writes are refused; another building cannot claim or record; a bad batch size is refused.
select pg_temp.as_user('a1000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$insert into public.notice_deliveries (building_id, notice_id, recipient_user_id, recipient_email) values (current_setting('test.building')::uuid, 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'x@example.invalid')$$,
  '42501', null, 'a delivery cannot be inserted directly');
select throws_ok($$select public.claim_notice_deliveries('a2000000-0000-4000-8000-000000000001', 500)$$,
  'P0001', 'invalid_batch', 'a batch larger than 200 is refused');
reset role;
select pg_temp.as_user('a1000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok($$select public.claim_notice_deliveries('a2000000-0000-4000-8000-000000000001', 10)$$,
  'P0001', 'forbidden', 'another building''s manager cannot claim this building''s deliveries');
reset role;

-- 17. Another building's manager cannot record an outcome for this building's delivery.
select pg_temp.as_user('a1000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok(format($$select public.record_notice_delivery_result(%L::uuid, true, null)$$,
  (select id from public.notice_deliveries where notice_id = 'a2000000-0000-4000-8000-000000000001')),
  'P0001', 'forbidden', 'another building''s manager cannot record an outcome');
reset role;

select * from finish();
rollback;
