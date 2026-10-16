-- Resident join: a manager invites a resident with a unit; only the invited, signed-in email can accept, once, before expiry
-- and before revocation; the unit is verified by a manager (not by the resident, not by another building); and residents
-- read only the in-force bylaws of their own building.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(18);

create or replace function pg_temp.as_user(uid text, email text default null) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'', ''email'', email)::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('97000000-0000-4000-8000-000000000001', 'rj-manager-t@example.invalid', now()),
  ('97000000-0000-4000-8000-000000000002', 'rj-resident-t@example.invalid', now()),
  ('97000000-0000-4000-8000-000000000003', 'rj-wrong-t@example.invalid', now()),
  ('97000000-0000-4000-8000-000000000004', 'rj-other-manager-t@example.invalid', now());

select pg_temp.as_user('97000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('Join Strata T', 'single_building', 'Join Building T', 'Manager T');
select set_config('test.building', (select id::text from public.buildings where name = 'Join Building T'), true);

select pg_temp.as_user('97000000-0000-4000-8000-000000000004');
select public.bootstrap_workspace('Other Join Strata T', 'single_building', 'Other Join Building T', 'Other manager');
select set_config('test.other_building', (select id::text from public.buildings where name = 'Other Join Building T'), true);

-- 1. The manager invites the resident with a unit: the unit is recorded on the invitation.
select pg_temp.as_user('97000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok(format($$select public.create_resident_invitation(%L::uuid, 'rj-resident-t@example.invalid', '12A', 'hash-resident-t', now() + interval '14 days')$$, current_setting('test.building')),
  'the manager invites a resident with a unit');
reset role;
select is((select unit_number from public.invitations where token_hash = 'hash-resident-t'), '12A', 'the invitation records the unit');

-- 2. An invitation without a unit is refused.
select pg_temp.as_user('97000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format($$select public.create_resident_invitation(%L::uuid, 'rj-x-t@example.invalid', '  ', 'hash-nounit-t', now() + interval '14 days')$$, current_setting('test.building')),
  'P0001', 'invalid_input', 'a resident invitation needs a unit');
reset role;

-- 3. A resident cannot invite, and another building's manager cannot invite into this building.
select pg_temp.as_user('97000000-0000-4000-8000-000000000002', 'rj-resident-t@example.invalid');
set local role authenticated;
select throws_ok(format($$select public.create_resident_invitation(%L::uuid, 'rj-x-t@example.invalid', '9', 'hash-by-resident-t', now() + interval '14 days')$$, current_setting('test.building')),
  'P0001', 'forbidden', 'a resident cannot invite residents');
reset role;
select pg_temp.as_user('97000000-0000-4000-8000-000000000004');
set local role authenticated;
select throws_ok(format($$select public.create_resident_invitation(%L::uuid, 'rj-x-t@example.invalid', '9', 'hash-cross-t', now() + interval '14 days')$$, current_setting('test.building')),
  'P0001', 'forbidden', 'another building''s manager cannot invite into this building');
reset role;

-- 4. Someone signed in with a different email cannot accept the invitation.
select pg_temp.as_user('97000000-0000-4000-8000-000000000003', 'rj-wrong-t@example.invalid');
set local role authenticated;
select throws_ok($$select public.accept_invitation('hash-resident-t')$$, 'P0001', 'invalid_invitation',
  'a different email cannot accept a resident invitation');
reset role;

-- 5. The invited email accepts: a resident membership with the unit, not yet verified.
select pg_temp.as_user('97000000-0000-4000-8000-000000000002', 'rj-resident-t@example.invalid');
set local role authenticated;
select is(public.accept_invitation('hash-resident-t')::text, current_setting('test.building'), 'the invited resident joins the building');
reset role;
select is((select role::text || '/' || unit_number || '/' || coalesce(unit_verified_at::text, 'unverified') from public.building_members
  where building_id = current_setting('test.building')::uuid and user_id = '97000000-0000-4000-8000-000000000002'),
  'owner_resident/12A/unverified', 'the membership records the unit as unverified');

-- 6. The same invitation cannot be used twice.
select pg_temp.as_user('97000000-0000-4000-8000-000000000002', 'rj-resident-t@example.invalid');
set local role authenticated;
select throws_ok($$select public.accept_invitation('hash-resident-t')$$, 'P0001', 'invalid_invitation', 'a used invitation is refused');
reset role;

-- 7. An expired invitation is refused (fixture: the expiry is in the past).
insert into public.invitations (building_id, email, role, invited_by, token_hash, membership_expires_at, expires_at, unit_number)
values (current_setting('test.building')::uuid, 'rj-expired-t@example.invalid', 'owner_resident', '97000000-0000-4000-8000-000000000001', 'hash-expired-t', null, now() - interval '1 day', '3B');
select pg_temp.as_user('97000000-0000-4000-8000-000000000002', 'rj-expired-t@example.invalid');
set local role authenticated;
select throws_ok($$select public.accept_invitation('hash-expired-t')$$, 'P0001', 'invalid_invitation', 'an expired invitation is refused');
reset role;

-- 8. A revoked invitation is refused.
select pg_temp.as_user('97000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.create_resident_invitation(current_setting('test.building')::uuid, 'rj-revoked-t@example.invalid', '7C', 'hash-revoked-t', now() + interval '14 days');
reset role;
select set_config('test.revoked_invitation', (select id::text from public.invitations where token_hash = 'hash-revoked-t'), true);
select pg_temp.as_user('97000000-0000-4000-8000-000000000001');
set local role authenticated;
select public.revoke_invitation(current_setting('test.revoked_invitation')::uuid);
reset role;
select pg_temp.as_user('97000000-0000-4000-8000-000000000003', 'rj-revoked-t@example.invalid');
set local role authenticated;
select throws_ok($$select public.accept_invitation('hash-revoked-t')$$, 'P0001', 'invalid_invitation', 'a revoked invitation is refused');
reset role;

-- 9. The resident cannot verify their own unit; another building's manager cannot verify it either.
select pg_temp.as_user('97000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok(format($$select public.verify_resident_unit(%L::uuid, '97000000-0000-4000-8000-000000000002', '12A')$$, current_setting('test.building')),
  'P0001', 'forbidden', 'a resident cannot verify their own unit');
reset role;
select pg_temp.as_user('97000000-0000-4000-8000-000000000004');
set local role authenticated;
select throws_ok(format($$select public.verify_resident_unit(%L::uuid, '97000000-0000-4000-8000-000000000002', '12A')$$, current_setting('test.building')),
  'P0001', 'forbidden', 'another building''s manager cannot verify this unit');
reset role;

-- 10. The manager's check must match the unit the resident entered.
select pg_temp.as_user('97000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format($$select public.verify_resident_unit(%L::uuid, '97000000-0000-4000-8000-000000000002', '99Z')$$, current_setting('test.building')),
  'P0001', 'unit_mismatch', 'a unit that does not match is refused');
select lives_ok(format($$select public.verify_resident_unit(%L::uuid, '97000000-0000-4000-8000-000000000002', '12A')$$, current_setting('test.building')),
  'the manager verifies the matching unit');
reset role;
select is((select (unit_verified_at is not null)::text || '/' || (unit_verified_by = '97000000-0000-4000-8000-000000000001')::text from public.building_members
  where building_id = current_setting('test.building')::uuid and user_id = '97000000-0000-4000-8000-000000000002'),
  'true/true', 'the verification records when and by whom');

-- 11. Residents read only the in-force bylaws of their building (fixture bylaws, written as the database owner).
insert into public.bylaw_sets (id, building_id, title) values ('97000000-0000-4000-8000-0000000000b1', current_setting('test.building')::uuid, 'Bylaws T');
insert into public.bylaw_nodes (id, building_id, set_id, section_ref, title) values ('97000000-0000-4000-8000-0000000000b2', current_setting('test.building')::uuid, '97000000-0000-4000-8000-0000000000b1', '4.1', 'Quiet hours');
insert into public.bylaw_versions (id, building_id, node_id, version, body, rationale, status, effective_date, filing_reference, review_choice, created_by) values
  ('97000000-0000-4000-8000-0000000000b3', current_setting('test.building')::uuid, '97000000-0000-4000-8000-0000000000b2', 1, 'Quiet from 10 pm to 7 am.', '', 'in_force', '2026-01-01', 'F-100', 'counsel', '97000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-0000000000b4', current_setting('test.building')::uuid, '97000000-0000-4000-8000-0000000000b2', 2, 'Draft quiet hours change.', '', 'draft', null, null, null, '97000000-0000-4000-8000-000000000001');
select pg_temp.as_user('97000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.bylaw_versions where building_id = current_setting('test.building')::uuid), 1,
  'a resident reads the in-force bylaw and not the draft');
reset role;
select pg_temp.as_user('97000000-0000-4000-8000-000000000004');
set local role authenticated;
select is((select count(*)::int from public.bylaw_versions where building_id = current_setting('test.building')::uuid), 0,
  'another building reads none of these bylaws');
reset role;

select * from finish();
rollback;
