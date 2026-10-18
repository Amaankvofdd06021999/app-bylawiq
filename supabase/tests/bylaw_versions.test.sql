-- Structured bylaws: a building manager creates a section and edits it as new versions. The history is append-only, and
-- nobody can write a version directly. A resident, another building's manager and a direct table write are all refused,
-- and a draft version is not visible to a resident.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(10);

create or replace function pg_temp.as_user(uid text) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'')::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('9c000000-0000-4000-8000-000000000001', 'bv-manager-t@example.invalid', now()),
  ('9c000000-0000-4000-8000-000000000002', 'bv-resident-t@example.invalid', now()),
  ('9c000000-0000-4000-8000-000000000003', 'bv-other-t@example.invalid', now());

select pg_temp.as_user('9c000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('BV Strata T', 'single_building', 'BV Building T', 'Manager T');
select set_config('test.building', (select id::text from public.buildings where name = 'BV Building T'), true);

select pg_temp.as_user('9c000000-0000-4000-8000-000000000003');
select public.bootstrap_workspace('BV Other Strata T', 'single_building', 'BV Other Building T', 'Other T');

insert into public.building_members (building_id, user_id, role, status)
values (current_setting('test.building')::uuid, '9c000000-0000-4000-8000-000000000002', 'owner_resident', 'active');

-- 1. The building's manager creates a section. The returned version is the first version of a new node.
select pg_temp.as_user('9c000000-0000-4000-8000-000000000001');
set local role authenticated;
select isnt(public.save_bylaw(current_setting('test.building')::uuid, null, 'Pets', '5.1', 'Two pets per unit.', 'Pet policy'), null,
  'the building manager creates a bylaw section');
reset role;
select set_config('test.version1', (select id::text from public.bylaw_versions where building_id = current_setting('test.building')::uuid order by created_at limit 1), true);
select set_config('test.node', (select node_id::text from public.bylaw_versions where id = current_setting('test.version1')::uuid), true);

-- 2. The first version is numbered 1.
select is((select version from public.bylaw_versions where id = current_setting('test.version1')::uuid), 1,
  'the first saved version is version 1');

-- 3. Editing the same section adds version 2. Earlier versions are kept.
set local role authenticated;
select public.save_bylaw(current_setting('test.building')::uuid, current_setting('test.node')::uuid, 'Pets', '5.1', 'Two pets per unit, with council approval for a third.', 'Council amendment');
reset role;
select is((select max(version)::int from public.bylaw_versions where node_id = current_setting('test.node')::uuid), 2,
  'editing the section adds version 2');

-- 4. The manager sees the full history, oldest first, with no version missing.
set local role authenticated;
select is((select count(*)::int from public.bylaw_versions where node_id = current_setting('test.node')::uuid), 2,
  'the manager reads both versions of the section');
reset role;

-- 5. A resident cannot create or edit a bylaw.
select pg_temp.as_user('9c000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok(format($$select public.save_bylaw(%L::uuid, null, 'Resident edit', '9.9', 'Not allowed.', '')$$, current_setting('test.building')::uuid),
  'P0001', 'forbidden', 'a resident cannot create a bylaw section');
reset role;

-- 6. Another building's manager cannot edit this building's section, even with its node id.
select pg_temp.as_user('9c000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok(format($$select public.save_bylaw(%L::uuid, %L::uuid, 'Other edit', '5.1', 'Not allowed.', '')$$,
  (select id from public.buildings where name = 'BV Other Building T'), current_setting('test.node')::uuid),
  'P0001', 'forbidden', 'another building''s manager cannot edit this building''s section');

-- 7. Another building's manager cannot read this building's versions.
select is((select count(*)::int from public.bylaw_versions where node_id = current_setting('test.node')::uuid), 0,
  'another building''s manager reads none of this building''s versions');
reset role;

-- 8. A resident does not read draft versions.
select pg_temp.as_user('9c000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.bylaw_versions where node_id = current_setting('test.node')::uuid and status = 'draft'), 0,
  'a resident does not read draft bylaw versions');
reset role;

-- 9. Nobody writes a version directly: the table grants no insert to authenticated.
select pg_temp.as_user('9c000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format($$insert into public.bylaw_versions (building_id, node_id, version, body, created_by) values (%L::uuid, %L::uuid, 3, 'Bypass', auth.uid())$$,
  current_setting('test.building')::uuid, current_setting('test.node')::uuid),
  '42501', 'permission denied for table bylaw_versions', 'a version cannot be inserted directly');

-- 10. Nobody rewrites a version directly either.
select throws_ok(format($$update public.bylaw_versions set body = 'Rewritten' where id = %L::uuid$$, current_setting('test.version1')::uuid),
  '42501', 'permission denied for table bylaw_versions', 'a version cannot be edited in place');
reset role;

select * from finish();
rollback;
