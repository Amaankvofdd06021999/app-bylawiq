-- MFA verification lease: one verification per admin at a time, through the database. Only the token from acquire can
-- release a lease. A release with another token, or by another user, changes nothing. An expired lease can be taken over,
-- and the old holder's token cannot clear the new lease. The lease table is not readable by authenticated users.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(8);

create or replace function pg_temp.as_user(uid text) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'')::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('99000000-0000-4000-8000-000000000001', 'lease-a-t@example.invalid', now()),
  ('99000000-0000-4000-8000-000000000002', 'lease-b-t@example.invalid', now());

-- 1. The first verification takes the lease and receives its token.
select pg_temp.as_user('99000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('test.token_a', public.acquire_mfa_verification(20)::text, true);
select isnt(current_setting('test.token_a'), '', 'the first verification takes the lease and gets a token');

-- 2. A second verification for the same admin is refused while the lease is held.
select is(public.acquire_mfa_verification(20)::text, null, 'a second verification is refused while the lease is held');

-- 3. A release with a token the caller does not hold changes nothing.
select public.release_mfa_verification('00000000-0000-4000-8000-000000000000');
select is(public.acquire_mfa_verification(20)::text, null, 'a release with a wrong token does not clear the lease');
reset role;

-- 4. Another admin's release cannot clear this admin's lease, even with the right token.
select pg_temp.as_user('99000000-0000-4000-8000-000000000002');
set local role authenticated;
select public.release_mfa_verification(current_setting('test.token_a')::uuid);
reset role;
select pg_temp.as_user('99000000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.acquire_mfa_verification(20)::text, null, 'another user cannot release this lease');

-- 5. The holder's release, with its token, frees the lease.
select public.release_mfa_verification(current_setting('test.token_a')::uuid);
select set_config('test.token_b', public.acquire_mfa_verification(20)::text, true);
select isnt(current_setting('test.token_b'), '', 'after the holder releases, the next verification takes the lease');
reset role;

-- 6. An expired lease is taken over; the previous holder's token then cannot clear the new lease.
update public.mfa_verification_leases set expires_at = now() - interval '1 second'
 where user_id = '99000000-0000-4000-8000-000000000001';
select pg_temp.as_user('99000000-0000-4000-8000-000000000001');
set local role authenticated;
select isnt(public.acquire_mfa_verification(20)::text, null, 'an expired lease is taken over');
select public.release_mfa_verification(current_setting('test.token_b')::uuid);
select is(public.acquire_mfa_verification(20)::text, null, 'the previous holder cannot clear the new lease');
reset role;

-- 7. The lease table is not readable by authenticated users.
select pg_temp.as_user('99000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select count(*) from public.mfa_verification_leases$$, '42501', null,
  'the lease table is not readable directly');
reset role;

select * from finish();
rollback;
