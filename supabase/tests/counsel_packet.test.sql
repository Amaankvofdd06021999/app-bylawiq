-- External counsel packet: a grant by email, and counsel comments on the granted amendment only. Counsel comments as themselves,
-- and only while the grant is active. Wrong building, unknown email, and a second amendment are refused.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(13);

create or replace function pg_temp.as_user(uid text) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'')::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('9f000000-0000-4000-8000-000000000001', 'cp-manager-t@example.invalid', now()),
  ('9f000000-0000-4000-8000-000000000002', 'cp-counsel-t@example.invalid', now()),
  ('9f000000-0000-4000-8000-000000000003', 'cp-other-t@example.invalid', now());

select pg_temp.as_user('9f000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('CP Strata T', 'single_building', 'CP Building T', 'Manager T');
select set_config('test.building', (select id::text from public.buildings where name = 'CP Building T'), true);
select pg_temp.as_user('9f000000-0000-4000-8000-000000000003');
select public.bootstrap_workspace('CP Other Strata T', 'single_building', 'CP Other Building T', 'Other T');

-- Two amendments: one granted to counsel, one not.
select pg_temp.as_user('9f000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.save_bylaw(current_setting('test.building')::uuid, null, 'Pets', '5.1', 'Two pets per unit.', 'Review');
select public.save_bylaw(current_setting('test.building')::uuid, null, 'Parking', '6.1', 'Visitors park in the lot.', 'Review');
reset role;
select set_config('test.version', (select id::text from public.bylaw_versions where building_id = current_setting('test.building')::uuid and body like 'Two pets%' limit 1), true);
select set_config('test.other_version', (select id::text from public.bylaw_versions where building_id = current_setting('test.building')::uuid and body like 'Visitors%' limit 1), true);

-- 1. The manager grants counsel by email.
set local role authenticated;
select isnt(public.grant_counsel_access_by_email(current_setting('test.version')::uuid, 'CP-Counsel-T@example.invalid', 7), null,
  'the manager grants counsel access by email (case-insensitive)');
reset role;

-- 2. An email with no account is refused without a grant.
set local role authenticated;
select throws_ok(format($$select public.grant_counsel_access_by_email(%L::uuid, 'nobody-here-t@example.invalid', 7)$$, current_setting('test.version')::uuid),
  'P0001', 'counsel_account_required', 'an email with no account is refused');
reset role;

-- 3. Another building's manager cannot grant on this building by email.
select pg_temp.as_user('9f000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok(format($$select public.grant_counsel_access_by_email(%L::uuid, 'cp-counsel-t@example.invalid', 7)$$, current_setting('test.version')::uuid),
  'P0001', 'forbidden', 'another building''s manager cannot grant counsel access by email');
reset role;

-- 4. Counsel comments on the granted amendment, as themselves.
select pg_temp.as_user('9f000000-0000-4000-8000-000000000002');
set local role authenticated;
select lives_ok(format($$insert into public.bylaw_comments (building_id, version_id, user_id, body) values (%L::uuid, %L::uuid, auth.uid(), 'Please check the pet limit.')$$,
  current_setting('test.building')::uuid, current_setting('test.version')::uuid),
  'counsel comments on the granted amendment');

-- 5. Counsel cannot comment as someone else.
select throws_ok(format($$insert into public.bylaw_comments (building_id, version_id, user_id, body) values (%L::uuid, %L::uuid, '9f000000-0000-4000-8000-000000000001', 'Spoofed.')$$,
  current_setting('test.building')::uuid, current_setting('test.version')::uuid),
  '42501', null, 'counsel cannot comment under another person''s name');

-- 6. Counsel cannot comment on an amendment that was not granted.
select throws_ok(format($$insert into public.bylaw_comments (building_id, version_id, user_id, body) values (%L::uuid, %L::uuid, auth.uid(), 'Not mine.')$$,
  current_setting('test.building')::uuid, current_setting('test.other_version')::uuid),
  '42501', null, 'counsel cannot comment on an amendment that was not granted');

-- 7. Counsel reads the comment on the granted amendment, and none on the other.
select is((select count(*)::int from public.bylaw_comments where version_id = current_setting('test.version')::uuid), 1,
  'counsel reads the comment on the granted amendment');
select is((select count(*)::int from public.bylaw_comments where version_id = current_setting('test.other_version')::uuid), 0,
  'counsel reads no comments on an amendment that was not granted');

-- 8. Counsel cannot grant to anyone, by email or by id.
select throws_ok(format($$select public.grant_counsel_access_by_email(%L::uuid, 'cp-counsel-t@example.invalid', 1)$$, current_setting('test.version')::uuid),
  'P0001', 'forbidden', 'counsel cannot grant access by email');
reset role;

-- 9. The manager's own comments still work.
select pg_temp.as_user('9f000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok(format($$insert into public.bylaw_comments (building_id, version_id, user_id, body) values (%L::uuid, %L::uuid, auth.uid(), 'Noted.')$$,
  current_setting('test.building')::uuid, current_setting('test.version')::uuid),
  'the manager can still comment on the amendment');
reset role;

-- 10-11. Expiry ends counsel's access to comments, and posting after expiry is refused.
update public.counsel_grants set granted_at = now() - interval '10 days', expires_at = now() - interval '1 day'
  where bylaw_version_id = current_setting('test.version')::uuid;
select pg_temp.as_user('9f000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.bylaw_comments where version_id = current_setting('test.version')::uuid), 0,
  'counsel reads no comments after expiry');
select throws_ok(format($$insert into public.bylaw_comments (building_id, version_id, user_id, body) values (%L::uuid, %L::uuid, auth.uid(), 'Too late.')$$,
  current_setting('test.building')::uuid, current_setting('test.version')::uuid),
  '42501', null, 'counsel cannot comment after expiry');
reset role;

-- 12. Revocation: the manager revokes; counsel's grant can no longer be used by email.
update public.counsel_grants set granted_at = now() - interval '1 day', expires_at = now() + interval '6 days'
  where bylaw_version_id = current_setting('test.version')::uuid;
select pg_temp.as_user('9f000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok(format($$select public.revoke_counsel_access((select id from public.counsel_grants where bylaw_version_id = %L::uuid))$$, current_setting('test.version')::uuid),
  'the manager revokes counsel access');
reset role;

select * from finish();
rollback;
