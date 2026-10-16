-- Firm knowledge: only an owner or admin of a firm can publish into its library; an active member can search and read it;
-- another firm cannot publish into it, search it by direct id, or read its documents or chunks; and short or unknown
-- input is refused.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(13);

create or replace function pg_temp.as_user(uid text, email text default null) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', ''aal1'', ''email'', email)::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('95000000-0000-4000-8000-000000000001', 'kb-owner-t@example.invalid', now()),
  ('95000000-0000-4000-8000-000000000002', 'kb-member-t@example.invalid', now()),
  ('95000000-0000-4000-8000-000000000003', 'kb-other-owner-t@example.invalid', now());

select pg_temp.as_user('95000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('Knowledge Firm T', 'admin', 'Knowledge Building T', 'Owner T');
select set_config('test.org', (select id::text from public.organizations where name = 'Knowledge Firm T'), true);

select pg_temp.as_user('95000000-0000-4000-8000-000000000003');
select public.bootstrap_workspace('Knowledge Firm U', 'admin', 'Knowledge Building U', 'Other owner');
select set_config('test.other_org', (select id::text from public.organizations where name = 'Knowledge Firm U'), true);

-- An active portfolio manager of firm T, created as the membership fixture the owner would otherwise add.
insert into public.org_members (org_id, user_id, role, status)
values (current_setting('test.org')::uuid, '95000000-0000-4000-8000-000000000002', 'portfolio_manager', 'active');

-- 1. The owner publishes a document of two paragraphs.
select pg_temp.as_user('95000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok(format($$select public.publish_firm_document(%L::uuid, 'Pet bylaw template', 'template', E'Pets are limited to two per unit.\n\nDogs must be leashed in common areas.')$$, current_setting('test.org')),
  'the owner publishes a document into the firm library');
reset role;
select is((select count(*)::int from public.firm_document_chunks c join public.firm_documents d on d.id = c.document_id
  where d.firm_id = current_setting('test.org')::uuid), 2,
  'each paragraph is stored as its own searchable chunk');

-- 2. A portfolio manager (not an owner or admin) cannot publish.
select pg_temp.as_user('95000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok(format($$select public.publish_firm_document(%L::uuid, 'Member doc', 'policy', 'A member tries to publish a policy document here.')$$, current_setting('test.org')),
  'P0001', 'forbidden', 'a portfolio manager cannot publish into the firm library');
reset role;

-- 3. Another firm's owner cannot publish into this firm.
select pg_temp.as_user('95000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok(format($$select public.publish_firm_document(%L::uuid, 'Cross firm', 'policy', 'Another firm tries to publish into this library.')$$, current_setting('test.org')),
  'P0001', 'forbidden', 'another firm cannot publish into this firm');
reset role;

-- 4. Input outside the limits is refused, and nothing is stored.
select pg_temp.as_user('95000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(format($$select public.publish_firm_document(%L::uuid, 'Too short', 'policy', 'Too short.')$$, current_setting('test.org')),
  'P0001', 'invalid_input', 'text under 20 characters is refused');
select throws_ok(format($$select public.publish_firm_document(%L::uuid, 'Bad kind', 'letter', 'A long enough body of text here.')$$, current_setting('test.org')),
  'P0001', 'invalid_input', 'an unknown kind is refused');
reset role;
select is((select count(*)::int from public.firm_documents where firm_id = current_setting('test.org')::uuid), 1,
  'refused publishes store nothing');

-- 5. An active member can read the published document and search it.
select pg_temp.as_user('95000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.firm_documents where firm_id = current_setting('test.org')::uuid), 1,
  'an active member sees the firm library');
select is((select count(*)::int from public.search_firm_knowledge(current_setting('test.org')::uuid, 'leashed', 10)), 1,
  'an active member finds the paragraph by search');

-- 6. Another firm's owner cannot search this firm by direct id, and sees none of its documents or chunks.
select pg_temp.as_user('95000000-0000-4000-8000-000000000003');
select throws_ok(format($$select count(*) from public.search_firm_knowledge(%L::uuid, 'leashed', 10)$$, current_setting('test.org')),
  '42501', 'Not a member of this firm', 'another firm cannot search this firm by direct id');
select is((select count(*)::int from public.firm_documents where firm_id = current_setting('test.org')::uuid), 0,
  'another firm reads none of this firm''s documents');
select is((select count(*)::int from public.firm_document_chunks where firm_id = current_setting('test.org')::uuid), 0,
  'another firm reads none of this firm''s chunks');
reset role;

-- 7. A member cannot write chunks directly; the only write path is publish_firm_document.
select pg_temp.as_user('95000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok(format($$insert into public.firm_document_chunks (document_id, firm_id, chunk_index, content)
  select id, %L::uuid, 9, 'Injected paragraph' from public.firm_documents where firm_id = %L::uuid limit 1$$,
  current_setting('test.org'), current_setting('test.org')),
  '42501', null, 'a member cannot insert chunks directly');
reset role;

select * from finish();
rollback;
