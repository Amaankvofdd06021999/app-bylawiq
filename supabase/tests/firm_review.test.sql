-- Firm review: a linked firm's owner or manager decides a building's draft in Postgres, and nothing else can. A decision
-- needs a reason to send back, only a pending review can be decided, a decision is final, a firm assistant cannot decide,
-- and another firm sees none of the review or its comments, including by direct id.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(17);

create or replace function pg_temp.as_user(uid text, email text default null) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'', ''email'', email)::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('96000000-0000-4000-8000-000000000001', 'rv-owner-t@example.invalid', now()),
  ('96000000-0000-4000-8000-000000000002', 'rv-assistant-t@example.invalid', now()),
  ('96000000-0000-4000-8000-000000000003', 'rv-other-owner-t@example.invalid', now()),
  ('96000000-0000-4000-8000-000000000004', 'rv-solo-t@example.invalid', now());

-- The firm owner creates the firm and its linked building.
select pg_temp.as_user('96000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('Review Firm T', 'admin', 'Review Building T', 'Owner T');
select set_config('test.org', (select id::text from public.organizations where name = 'Review Firm T'), true);
select set_config('test.building', (select id::text from public.buildings where name = 'Review Building T'), true);
select set_config('test.link', (select l.id::text from public.firm_building_links l
  where l.building_id = current_setting('test.building')::uuid and l.status = 'active'), true);

-- A firm assistant is linked to the building, the same way a joining firm member is.
insert into public.org_members (org_id, user_id, role, status)
values (current_setting('test.org')::uuid, '96000000-0000-4000-8000-000000000002', 'portfolio_assistant', 'active');
select private.add_link_members(current_setting('test.link')::uuid);

-- Another firm's owner, and a building manager with no firm link.
select pg_temp.as_user('96000000-0000-4000-8000-000000000003');
select public.bootstrap_workspace('Other Review Firm T', 'admin', 'Other Review Building T', 'Other owner');
select pg_temp.as_user('96000000-0000-4000-8000-000000000004');
select public.bootstrap_workspace('Solo T', 'single_building', 'Solo Building T', 'Solo');
select set_config('test.solo', (select id::text from public.buildings where name = 'Solo Building T'), true);

-- Two drafts (fixtures, as the building would have saved them). The first goes to review through request_firm_review.
insert into public.generated_documents (id, building_id, title, kind, body_md, created_by) values
  ('96000000-0000-4000-8000-0000000000a1', current_setting('test.building')::uuid, 'Notice A', 'council_report', 'Body A for review.', '96000000-0000-4000-8000-000000000001'),
  ('96000000-0000-4000-8000-0000000000a2', current_setting('test.building')::uuid, 'Notice B', 'council_report', 'Body B for review.', '96000000-0000-4000-8000-000000000001');

-- 1. The building's draft is sent to the firm for review.
select pg_temp.as_user('96000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select public.request_firm_review('96000000-0000-4000-8000-0000000000a1')$$,
  'a draft is sent to the linked firm for review');
reset role;
select is((select status || '/' || review_by from public.generated_documents where id = '96000000-0000-4000-8000-0000000000a1'),
  'pending_review/firm', 'the review is recorded as pending with the firm');

-- 2. A firm assistant (no review permission) cannot decide.
select pg_temp.as_user('96000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok($$select public.decide_firm_review('96000000-0000-4000-8000-0000000000a1', 'approved', '')$$,
  'P0001', 'forbidden', 'a firm assistant cannot decide a review');
reset role;

-- 3. Another firm's owner cannot decide this firm's review by direct id.
select pg_temp.as_user('96000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok($$select public.decide_firm_review('96000000-0000-4000-8000-0000000000a1', 'approved', '')$$,
  'P0001', 'forbidden', 'another firm cannot decide this review by direct id');
reset role;

-- 4. An unlinked building manager cannot decide the firm's review either.
select pg_temp.as_user('96000000-0000-4000-8000-000000000004');
set local role authenticated;
select throws_ok($$select public.decide_firm_review('96000000-0000-4000-8000-0000000000a1', 'approved', '')$$,
  'P0001', 'forbidden', 'an unlinked building manager cannot decide the review');
reset role;

-- 5. Another firm cannot send the building's draft to its own review (it has no document.draft on this building).
select pg_temp.as_user('96000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok($$select public.request_firm_review('96000000-0000-4000-8000-0000000000a2')$$,
  'P0001', 'forbidden', 'another firm cannot send this building''s draft for review');
reset role;

-- 6. Another firm reads none of this building's documents or review comments.
select pg_temp.as_user('96000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.generated_documents where building_id = current_setting('test.building')::uuid), 0,
  'another firm reads none of this building''s documents');
reset role;

-- 7. The firm owner must give a reason to send changes back.
select pg_temp.as_user('96000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.decide_firm_review('96000000-0000-4000-8000-0000000000a1', 'changes_requested', '   ')$$,
  'P0001', 'comment_required', 'changes cannot be requested without a reason');
reset role;
select is((select status from public.generated_documents where id = '96000000-0000-4000-8000-0000000000a1'), 'pending_review',
  'a refused decision leaves the review pending');

-- 8. The firm owner requests changes with a reason; the reason is stored as a comment.
select pg_temp.as_user('96000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select public.decide_firm_review('96000000-0000-4000-8000-0000000000a1', 'changes_requested', 'Cite the bylaw section.')$$,
  'the firm owner requests changes with a reason');
reset role;
select is((select status from public.generated_documents where id = '96000000-0000-4000-8000-0000000000a1'), 'changes_requested',
  'the draft returns to the building as changes requested');

-- 9. A review that has been sent back is not pending, so the firm cannot approve it without the building resubmitting.
select pg_temp.as_user('96000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.decide_firm_review('96000000-0000-4000-8000-0000000000a1', 'approved', '')$$,
  'P0001', 'invalid_transition', 'a draft that is not awaiting review cannot be approved');
reset role;

-- 10. A firm approval records who approved, and it cannot be repeated.
insert into public.generated_documents (id, building_id, title, kind, body_md, created_by, status, review_by) values
  ('96000000-0000-4000-8000-0000000000a3', current_setting('test.building')::uuid, 'Notice C', 'council_report', 'Body C for review.', '96000000-0000-4000-8000-000000000001', 'pending_review', 'firm');
select pg_temp.as_user('96000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select public.decide_firm_review('96000000-0000-4000-8000-0000000000a3', 'approved', '')$$,
  'the firm owner approves a pending review');
reset role;
select is((select status || '/' || approved_by::text from public.generated_documents where id = '96000000-0000-4000-8000-0000000000a3'),
  'approved/96000000-0000-4000-8000-000000000001', 'the approval records the approving firm owner');
select pg_temp.as_user('96000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.decide_firm_review('96000000-0000-4000-8000-0000000000a3', 'changes_requested', 'Too late.')$$,
  'P0001', 'invalid_transition', 'an approved review cannot be decided again');
reset role;

-- 11. Another firm reads none of the review comments.
select is((select count(*)::int from public.document_review_comments where building_id = current_setting('test.building')::uuid), 1,
  'the reason sent back is recorded as one review comment');
select pg_temp.as_user('96000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*)::int from public.document_review_comments where building_id = current_setting('test.building')::uuid), 0,
  'another firm reads none of this building''s review comments');
reset role;

select * from finish();
rollback;
