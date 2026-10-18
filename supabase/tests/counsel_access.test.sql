-- Time-limited counsel access: a manager grants one amendment to counsel for 1 to 30 days. Counsel reads it while the grant is
-- active, and cannot write, adopt or grant. Another building's manager cannot grant, read or revoke. Expiry and revocation end
-- access. Only one active grant per counsel and amendment.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(19);

create or replace function pg_temp.as_user(uid text) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'')::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('9e000000-0000-4000-8000-000000000001', 'ca-manager-t@example.invalid', now()),
  ('9e000000-0000-4000-8000-000000000002', 'ca-counsel-t@example.invalid', now()),
  ('9e000000-0000-4000-8000-000000000003', 'ca-other-t@example.invalid', now());

select pg_temp.as_user('9e000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('CA Strata T', 'single_building', 'CA Building T', 'Manager T');
select set_config('test.building', (select id::text from public.buildings where name = 'CA Building T'), true);

select pg_temp.as_user('9e000000-0000-4000-8000-000000000003');
select public.bootstrap_workspace('CA Other Strata T', 'single_building', 'CA Other Building T', 'Other T');

-- The manager drafts one amendment.
select pg_temp.as_user('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.save_bylaw(current_setting('test.building')::uuid, null, 'Pets', '5.1', 'Two pets per unit.', 'Review');
reset role;
select set_config('test.version', (select id::text from public.bylaw_versions where building_id = current_setting('test.building')::uuid order by created_at desc limit 1), true);
select set_config('test.node', (select node_id::text from public.bylaw_versions where id = current_setting('test.version')::uuid), true);

-- 1. The manager grants counsel access for 7 days.
set local role authenticated;
select isnt(public.grant_counsel_access(current_setting('test.version')::uuid, '9e000000-0000-4000-8000-000000000002', 7), null,
  'the manager grants counsel access to one amendment for 7 days');
reset role;
select set_config('test.grant', (select id::text from public.counsel_grants where bylaw_version_id = current_setting('test.version')::uuid), true);

-- 2-3. Counsel reads the amendment and its section while the grant is active.
select pg_temp.as_user('9e000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.bylaw_versions where id = current_setting('test.version')::uuid), 1,
  'counsel reads the granted amendment');
select is((select count(*)::int from public.bylaw_nodes where id = current_setting('test.node')::uuid), 1,
  'counsel reads the section of the granted amendment');

-- 4-6. Counsel writes nothing, adopts nothing and grants nothing.
select throws_ok(format($$insert into public.bylaw_versions (building_id, node_id, version, body, created_by) values (%L::uuid, %L::uuid, 9, 'Counsel edit', auth.uid())$$,
  current_setting('test.building')::uuid, current_setting('test.node')::uuid),
  '42501', 'permission denied for table bylaw_versions', 'counsel cannot write a version');
select throws_ok(format($$select public.transition_bylaw(%L::uuid, 'in_review')$$, current_setting('test.version')::uuid),
  'P0001', 'forbidden', 'counsel cannot move the amendment through its stages');
select throws_ok(format($$select public.grant_counsel_access(%L::uuid, '9e000000-0000-4000-8000-000000000002', 1)$$, current_setting('test.version')::uuid),
  'P0001', 'forbidden', 'counsel cannot grant access to anyone');

-- 7. Counsel sees only their own grant.
select is((select count(*)::int from public.counsel_grants), 1, 'counsel sees only their own grant');
reset role;

-- 8-9. Another building's manager cannot grant on this building, and cannot see its grants.
select pg_temp.as_user('9e000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok(format($$select public.grant_counsel_access(%L::uuid, '9e000000-0000-4000-8000-000000000002', 7)$$, current_setting('test.version')::uuid),
  'P0001', 'forbidden', 'another building''s manager cannot grant counsel access');
select is((select count(*)::int from public.counsel_grants where building_id = current_setting('test.building')::uuid), 0,
  'another building''s manager reads none of this building''s grants');
select throws_ok(format($$select public.revoke_counsel_access(%L::uuid)$$, current_setting('test.grant')::uuid),
  'P0001', 'forbidden', 'another building''s manager cannot revoke a grant');
reset role;

-- 10-11. The period is 1 to 30 days.
select pg_temp.as_user('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format($$select public.grant_counsel_access(%L::uuid, '9e000000-0000-4000-8000-000000000002', 31)$$, current_setting('test.version')::uuid),
  'P0001', 'invalid_period', 'a grant longer than 30 days is refused');
select throws_ok(format($$select public.grant_counsel_access(%L::uuid, '9e000000-0000-4000-8000-000000000002', 0)$$, current_setting('test.version')::uuid),
  'P0001', 'invalid_period', 'a grant of zero days is refused');

-- 12. Only one active grant per counsel and amendment.
select throws_ok(format($$select public.grant_counsel_access(%L::uuid, '9e000000-0000-4000-8000-000000000002', 7)$$, current_setting('test.version')::uuid),
  '23505', null, 'a second active grant for the same counsel and amendment is refused');
reset role;

-- 13-14. Expiry ends access. Counsel then reads nothing.
update public.counsel_grants set granted_at = now() - interval '10 days', expires_at = now() - interval '1 day'
  where id = current_setting('test.grant')::uuid;
select pg_temp.as_user('9e000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.bylaw_versions where id = current_setting('test.version')::uuid), 0,
  'counsel reads nothing after the grant expires');
reset role;

-- 15. Restoring the period restores access (the grant is the source of truth).
update public.counsel_grants set granted_at = now() - interval '1 day', expires_at = now() + interval '6 days'
  where id = current_setting('test.grant')::uuid;
select pg_temp.as_user('9e000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.bylaw_versions where id = current_setting('test.version')::uuid), 1,
  'counsel reads the amendment again while the grant is active');
reset role;

-- 16-17. The manager revokes. Counsel reads nothing, and a second revocation is refused.
select pg_temp.as_user('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok(format($$select public.revoke_counsel_access(%L::uuid)$$, current_setting('test.grant')::uuid),
  'the manager revokes counsel access');
reset role;
select pg_temp.as_user('9e000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.bylaw_versions where id = current_setting('test.version')::uuid), 0,
  'counsel reads nothing after revocation');
reset role;
select pg_temp.as_user('9e000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format($$select public.revoke_counsel_access(%L::uuid)$$, current_setting('test.grant')::uuid),
  'P0001', 'already_revoked', 'a grant cannot be revoked twice');
reset role;

-- 18. The grant stays on record after revocation, with its revocation time.
select isnt((select revoked_at from public.counsel_grants where id = current_setting('test.grant')::uuid), null,
  'the grant stays on record with its revocation time');

select * from finish();
rollback;
