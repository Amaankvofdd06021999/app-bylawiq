-- Firm team: only an active owner of a firm can invite, revoke or remove; a member must sign in with the invited email;
-- an invitation is single use; no one can remove themselves; and another firm sees none of this.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(13);

create or replace function pg_temp.as_user(uid text, email text default null) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'', ''email'', email)::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('94000000-0000-4000-8000-000000000001', 'owner-t@example.invalid', now()),
  ('94000000-0000-4000-8000-000000000002', 'member-t@example.invalid', now()),
  ('94000000-0000-4000-8000-000000000003', 'other-owner-t@example.invalid', now()),
  ('94000000-0000-4000-8000-000000000004', 'invitee-t@example.invalid', now());

select pg_temp.as_user('94000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('Firm T', 'admin', 'Building T', 'Owner T');
select set_config('test.org', (select id::text from public.organizations where name = 'Firm T'), true);

select pg_temp.as_user('94000000-0000-4000-8000-000000000003');
select public.bootstrap_workspace('Firm U', 'admin', 'Building U', 'Other owner');
select set_config('test.other_org', (select id::text from public.organizations where name = 'Firm U'), true);

-- A non-owner member of firm T (a portfolio manager), created as a fixture of the membership the owner would add.
insert into public.org_members (org_id, user_id, role, status)
values (current_setting('test.org')::uuid, '94000000-0000-4000-8000-000000000002', 'portfolio_manager', 'active');

-- 1. The owner invites: the invitation is recorded for the lower-cased email.
select pg_temp.as_user('94000000-0000-4000-8000-000000000001');
select lives_ok(format($$select public.create_firm_invitation(%L::uuid, 'Invitee-T@Example.invalid', 'portfolio_manager', 'hash-invitee-t', now() + interval '7 days')$$, current_setting('test.org')),
  'the owner creates an invitation');
select is((select email from public.firm_invitations where token_hash = 'hash-invitee-t'), 'invitee-t@example.invalid',
  'the invitation is stored with the lower-cased email');
reset role;

-- 2. A non-owner member cannot invite.
select pg_temp.as_user('94000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok(format($$select public.create_firm_invitation(%L::uuid, 'x@example.invalid', 'portfolio_manager', 'hash-denied', now() + interval '7 days')$$, current_setting('test.org')),
  'P0001', 'forbidden', 'a non-owner member cannot invite');
reset role;

-- 3. Another firm's owner cannot invite into this firm, and cannot read its invitations.
select pg_temp.as_user('94000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok(format($$select public.create_firm_invitation(%L::uuid, 'x@example.invalid', 'portfolio_manager', 'hash-cross', now() + interval '7 days')$$, current_setting('test.org')),
  'P0001', 'forbidden', 'another firm cannot invite into this firm');
select is((select count(*)::int from public.firm_invitations where org_id = current_setting('test.org')::uuid), 0,
  'another firm reads none of this firm''s invitations');
reset role;

-- 4. Owners cannot grant the owner role through an invitation.
select pg_temp.as_user('94000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format($$select public.create_firm_invitation(%L::uuid, 'y@example.invalid', 'org_owner', 'hash-owner-role', now() + interval '7 days')$$, current_setting('test.org')),
  'P0001', 'invalid_role', 'an invitation cannot grant the owner role');
reset role;

-- 5. The invitee must sign in with the invited email.
select pg_temp.as_user('94000000-0000-4000-8000-000000000003', 'someone-else@example.invalid');
set local role authenticated;
select throws_ok($$select public.accept_firm_invitation('hash-invitee-t')$$, 'P0001', 'invitation_email_mismatch',
  'a different email cannot accept the invitation');
reset role;

-- 6. The invited email accepts once, and becomes an active member with the invited role.
select pg_temp.as_user('94000000-0000-4000-8000-000000000004', 'invitee-t@example.invalid');
set local role authenticated;
select is(public.accept_firm_invitation('hash-invitee-t')::text, current_setting('test.org'),
  'the invited email accepts and joins the firm');
reset role;
select is((select role::text || '/' || status from public.org_members
  where org_id = current_setting('test.org')::uuid and user_id = '94000000-0000-4000-8000-000000000004'),
  'portfolio_manager/active', 'the new member has the invited role and is active');

-- 7. A used invitation cannot be accepted again.
select pg_temp.as_user('94000000-0000-4000-8000-000000000004', 'invitee-t@example.invalid');
set local role authenticated;
select throws_ok($$select public.accept_firm_invitation('hash-invitee-t')$$, 'P0001', 'invitation_unavailable',
  'a used invitation is refused');
reset role;

-- 8. A revoked invitation is refused.
select pg_temp.as_user('94000000-0000-4000-8000-000000000001');
select public.create_firm_invitation(current_setting('test.org')::uuid, 'revoked-t@example.invalid', 'org_admin', 'hash-revoked', now() + interval '7 days');
select public.revoke_firm_invitation((select id from public.firm_invitations where token_hash = 'hash-revoked'));
reset role;
select pg_temp.as_user('94000000-0000-4000-8000-000000000005', 'revoked-t@example.invalid');
set local role authenticated;
select throws_ok($$select public.accept_firm_invitation('hash-revoked')$$, 'P0001', 'invitation_unavailable',
  'a revoked invitation is refused');
reset role;

-- 9. Owners cannot remove themselves; a non-owner cannot remove anyone.
select pg_temp.as_user('94000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format($$select public.remove_firm_member(%L::uuid, '94000000-0000-4000-8000-000000000001')$$, current_setting('test.org')),
  'P0001', 'cannot_remove_self', 'an owner cannot remove themselves');
reset role;
select pg_temp.as_user('94000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok(format($$select public.remove_firm_member(%L::uuid, '94000000-0000-4000-8000-000000000004')$$, current_setting('test.org')),
  'P0001', 'forbidden', 'a non-owner cannot remove a member');
reset role;

select * from finish();
rollback;
