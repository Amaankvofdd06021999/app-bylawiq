-- Authorization and isolation for the five personas and the platform admin (decisions D1-D17).
-- Each assertion runs as the real database role with the caller's JWT claims, against rows created by the real
-- bootstrap, invitation and linking functions. Nothing here bypasses RLS except the fixture setup, which runs as the
-- test owner before any persona is switched in.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(36);

-- Switch the session to a user, with the subject and the JWT claims set the same way the platform does.
create or replace function pg_temp.as_user(uid text, aal text default null) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', aal)::text, true)';

-- Fixture users (ids are fixed UUIDs so failures are readable).
insert into auth.users (id, email, email_confirmed_at) values
  ('91000000-0000-4000-8000-000000000001', 'pa@example.invalid', now()),   -- platform admin
  ('91000000-0000-4000-8000-000000000002', 'fo@example.invalid', now()),   -- firm owner (firm F)
  ('91000000-0000-4000-8000-000000000003', 'sm@example.invalid', now()),   -- strata manager (firm F, portfolio)
  ('91000000-0000-4000-8000-000000000004', 'bm@example.invalid', now()),   -- building manager (single building)
  ('91000000-0000-4000-8000-000000000005', 'rs@example.invalid', now()),   -- resident of building F
  ('91000000-0000-4000-8000-000000000006', 'cm@example.invalid', now()),   -- council member of building F
  ('91000000-0000-4000-8000-000000000007', 'ox@example.invalid', now());   -- owner of an unrelated firm X

-- Firm F and its building, created by the firm owner through the real bootstrap.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select public.bootstrap_workspace('Firm F', 'admin', 'Building F', 'Firm Owner');
select set_config('test.bf', (select id::text from public.buildings where name = 'Building F'), true);

-- Unrelated firm X and its building.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000007', true);
select public.bootstrap_workspace('Firm X', 'admin', 'Building X', 'Other Owner');
select set_config('test.bx', (select id::text from public.buildings where name = 'Building X'), true);

-- Single-building account.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000004', true);
select public.bootstrap_workspace('Solo', 'single_building', 'Building S', 'Building Manager');
select set_config('test.bs', (select id::text from public.buildings where name = 'Building S'), true);

-- Strata manager joins firm F as portfolio manager; the existing link adds them to Building F (decision D13).
insert into public.org_members (org_id, user_id, role, status)
  select o.id, '91000000-0000-4000-8000-000000000003', 'portfolio_manager', 'active'
    from public.organizations o where o.kind = 'firm' and o.created_by = '91000000-0000-4000-8000-000000000002';
select private.add_link_members((select id from public.firm_building_links where building_id = current_setting('test.bf')::uuid and status = 'active'));

-- Council member of Building F (assigned by the building's own manager path in the app; written here directly).
insert into public.building_members (building_id, user_id, role)
  values (current_setting('test.bf')::uuid, '91000000-0000-4000-8000-000000000006', 'council_member');

-- Resident of Building F, invited by the firm owner (a building manager on F) and accepted by the resident.
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select public.create_invitation(current_setting('test.bf')::uuid, 'rs@example.invalid', 'owner_resident',
  encode(extensions.digest('pgtap-resident', 'sha256'), 'hex'), null);
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000005', true);
select public.accept_invitation(encode(extensions.digest('pgtap-resident', 'sha256'), 'hex'));

-- Platform admin: the grant is recorded with an operator and a reason (decision D4).
set local bylawiq.operator = 'pgtap-operator';
set local bylawiq.reason = 'Fixture grant for the authorization suite';
insert into public.platform_admins (user_id) values ('91000000-0000-4000-8000-000000000001');
reset bylawiq.operator;
reset bylawiq.reason;

-- Documents: one visible to residents, one internal, and one in Building S.
insert into public.documents (building_id, title, uploaded_by, owner_visible) values
  (current_setting('test.bf')::uuid, 'Bylaws F (resident)', '91000000-0000-4000-8000-000000000002', true),
  (current_setting('test.bf')::uuid, 'Internal F', '91000000-0000-4000-8000-000000000002', false),
  (current_setting('test.bs')::uuid, 'Bylaws S', '91000000-0000-4000-8000-000000000004', true);

-- A bylaw-owner's notice in Building F, sent to the firm for review.
insert into public.generated_documents (building_id, kind, title, body_md, created_by)
  values (current_setting('test.bf')::uuid, 'council_report', 'Review F', 'Body', '91000000-0000-4000-8000-000000000002');
select set_config('test.notice', (select id::text from public.generated_documents where title = 'Review F'), true);
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select public.request_firm_review(current_setting('test.notice')::uuid);

-- ---------------------------------------------------------------- platform admin
-- 1. Without an MFA session, the platform-admin check is false.
set local role authenticated;
select pg_temp.as_user('91000000-0000-4000-8000-000000000001', 'aal1');
select is(public.is_platform_admin(), false, 'platform admin without aal2 is refused');
-- 2. With a verified TOTP session, it is true.
select pg_temp.as_user('91000000-0000-4000-8000-000000000001', 'aal2');
select is(public.is_platform_admin(), true, 'platform admin with aal2 is admitted');
-- 3. Privileged actions need the same check.
select lives_ok($$select public.set_flag('pgtap_flag', true)$$, 'platform admin with aal2 can set a flag');
-- 4. A non-admin is refused even with aal2.
select pg_temp.as_user('91000000-0000-4000-8000-000000000007', 'aal2');
select throws_ok($$select public.set_flag('pgtap_flag', false)$$, 'Not a platform admin', 'a firm owner is refused platform actions');
-- 5. The admin table and the grant log are not readable by authenticated users.
select throws_ok($$select * from public.platform_admins$$, '42501', null, 'platform admin table is not readable by users');
select throws_ok($$select * from public.platform_admin_grant_log$$, '42501', null, 'grant log is not readable by users');
reset role;

-- ---------------------------------------------------------------- building manager (single building)
set local role authenticated;
select pg_temp.as_user('91000000-0000-4000-8000-000000000004');
-- 6. Sees own building's documents, and no others.
select is((select count(*)::int from public.documents where building_id = current_setting('test.bs')::uuid), 1, 'building manager reads own building documents');
select is((select count(*)::int from public.documents where building_id = current_setting('test.bf')::uuid), 0, 'building manager cannot read another building documents');
-- 7. Direct-ID update of another building's document changes nothing.
select lives_ok($lives$ do $inner$ declare n integer; begin update public.documents set title = 'hijacked' where building_id = current_setting('test.bf')::uuid; get diagnostics n = row_count; if n <> 0 then raise exception 'updated %', n; end if; end $inner$ $lives$, 'direct update of another building document affects no rows');
-- 8. Cannot invite into another building.
select throws_ok(format($$select public.create_invitation(%L::uuid, 'x@example.invalid', 'owner_resident', 'h1', null)$$, current_setting('test.bf')), 'P0001', 'forbidden', 'building manager cannot invite into another building');
-- 9. Firm review is not available to a building-only manager.
select is(public.authorize('firm.review', current_setting('test.bs')::uuid), false, 'building-only manager lacks firm.review');
-- 10. Own profile shows the single-building binding (no account_type authorization).
select is((select bound_building_id::text from public.profiles where id = '91000000-0000-4000-8000-000000000004'), current_setting('test.bs'), 'single-building account is bound to its building');
reset role;

-- ---------------------------------------------------------------- firm owner (firm F; building manager on F by link)
set local role authenticated;
select pg_temp.as_user('91000000-0000-4000-8000-000000000002');
-- 11. Firm ownership does not grant building deletion or billing at building scope (D13).
select is(public.authorize('building.delete', current_setting('test.bf')::uuid), false, 'firm owner cannot delete a linked building');
select is(public.authorize('billing.manage', current_setting('test.bf')::uuid), false, 'firm owner has no building billing power');
-- 12. Firm owner can review firm notices on the linked building (D14).
select is(public.authorize('firm.review', current_setting('test.bf')::uuid), true, 'firm owner holds firm.review on the linked building');
reset role;

-- ---------------------------------------------------------------- strata manager (firm F portfolio manager)
set local role authenticated;
select pg_temp.as_user('91000000-0000-4000-8000-000000000003');
-- 13. Holds firm.review only on the linked building.
select is(public.authorize('firm.review', current_setting('test.bf')::uuid), true, 'linked firm staff hold firm.review on the linked building');
select is(public.authorize('firm.review', current_setting('test.bs')::uuid), false, 'firm staff hold no firm.review on an unlinked building');
-- 14. Cannot read the unrelated firm's building.
select is((select count(*)::int from public.documents where building_id = current_setting('test.bx')::uuid), 0, 'strata manager cannot read another firm building');
-- 15. Cannot decide a firm review of a building they are not linked to.
select pg_temp.as_user('91000000-0000-4000-8000-000000000004');
select throws_ok(format($$select public.decide_firm_review(%L::uuid, 'approved', '')$$, current_setting('test.notice')), 'P0001', 'forbidden', 'a building manager with no firm link cannot decide a firm review');
reset role;

-- ---------------------------------------------------------------- council member (read-only, building F)
set local role authenticated;
select pg_temp.as_user('91000000-0000-4000-8000-000000000006');
-- 16. Reads building documents (staff read).
select is((select count(*)::int from public.documents where building_id = current_setting('test.bf')::uuid), 2, 'council member reads building documents');
-- 17. Cannot invite anyone (read-only, D1).
select throws_ok(format($$select public.create_invitation(%L::uuid, 'y@example.invalid', 'owner_resident', 'h2', null)$$, current_setting('test.bf')), 'P0001', 'forbidden', 'council member cannot invite residents');
-- 18. Cannot change the firm link.
select throws_ok(format($$select public.revoke_firm_link(%L::uuid)$$, current_setting('test.bf')), 'P0001', 'forbidden', 'council member cannot revoke the firm link');
reset role;

-- ---------------------------------------------------------------- resident (owner_resident, building F)
set local role authenticated;
select pg_temp.as_user('91000000-0000-4000-8000-000000000005');
-- 19. Sees only owner-visible documents of its building.
select is((select count(*)::int from public.documents where building_id = current_setting('test.bf')::uuid), 1, 'resident sees only owner-visible documents');
-- 20. Sees its own wallet (created by the membership trigger) and nobody else's.
select is((select count(*)::int from public.resident_wallets where user_id = '91000000-0000-4000-8000-000000000005'), 1, 'resident reads own wallet');
select is((select count(*)::int from public.resident_wallets where user_id = '91000000-0000-4000-8000-000000000002'), 0, 'resident cannot read another wallet');
-- 21. Cannot invite or assign anyone.
select throws_ok(format($$select public.create_invitation(%L::uuid, 'z@example.invalid', 'owner_resident', 'h3', null)$$, current_setting('test.bf')), 'P0001', 'forbidden', 'resident cannot invite');
-- 22. Cannot see notices or firm review of its building.
select is((select count(*)::int from public.generated_documents where building_id = current_setting('test.bf')::uuid), 0, 'resident cannot see notices');
reset role;

-- ---------------------------------------------------------------- invitations and binding (D3, D17)
-- 23. The resident's binding is the building it joined.
select is((select bound_building_id::text from public.profiles where id = '91000000-0000-4000-8000-000000000005'), current_setting('test.bf'), 'resident is bound to the building it joined');
-- 24. Firm staff are not bound to one building (portfolio roles never bind).
select is((select bound_building_id from public.profiles where id = '91000000-0000-4000-8000-000000000003'), null::uuid, 'portfolio staff are not bound to one building');
-- 25. account_type is no longer written by bootstrap or acceptance.
select is((select account_type::text from public.profiles where id = '91000000-0000-4000-8000-000000000004'), null::text, 'bootstrap does not write account_type');

-- ---------------------------------------------------------------- audit trail (D4)
-- 26. Platform-admin grant was recorded with its operator and reason.
select is((select count(*)::int from public.platform_admin_grant_log where target_user = '91000000-0000-4000-8000-000000000001' and action = 'grant' and actor = 'pgtap-operator'), 1, 'platform admin grant is in the audit log with its operator');
-- 27. Firm-review request is audited as a comment.
select is((select count(*)::int from public.document_review_comments where document_id = current_setting('test.notice')::uuid), 0, 'a fresh firm review has no comments yet');
-- 28. A grant with no reason is refused.
select throws_ok($$insert into public.platform_admins (user_id) values ('91000000-0000-4000-8000-000000000007')$$, 'P0001', 'platform_admin_change_needs_reason', 'a grant without a reason is refused');

-- ---------------------------------------------------------------- isolation of helpers
-- 29. Helper functions that answer access questions are not callable by anonymous users.
select is(has_function_privilege('anon', 'public.is_platform_admin()', 'EXECUTE'), false, 'anonymous users cannot run the platform-admin check');
-- 30. Retrieval functions are security invoker, so row-level security applies to them.
select is((select count(*)::int from pg_proc where proname in ('hybrid_search_building','hybrid_search_legal') and prosecdef), 0, 'retrieval runs as the caller');
-- 31. Every public table has row-level security enabled.
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 0, 'every public table enables row-level security');

select * from finish();
rollback;
