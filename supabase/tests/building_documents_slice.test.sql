-- Vertical slice: a building manager uploads a document, it is indexed, confirmed, and retrieved by Ask only for that
-- building and only while it is in force. Each assertion runs as the real database role with the caller's JWT claims.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(15);

create or replace function pg_temp.as_user(uid text, aal text default null) returns void
language sql as 'select set_config(''request.jwt.claim.sub'', uid, true), set_config(''request.jwt.claims'', json_build_object(''sub'', uid, ''role'', ''authenticated'', ''aal'', aal)::text, true)';

insert into auth.users (id, email, email_confirmed_at) values
  ('93000000-0000-4000-8000-000000000001', 'bma@example.invalid', now()),
  ('93000000-0000-4000-8000-000000000002', 'bmb@example.invalid', now());

-- Building A (manager A) and building B (manager B), created through the real bootstrap.
select pg_temp.as_user('93000000-0000-4000-8000-000000000001');
select public.bootstrap_workspace('Firm A', 'admin', 'Building A', 'Manager A');
select set_config('test.a', (select id::text from public.buildings where name = 'Building A'), true);

select pg_temp.as_user('93000000-0000-4000-8000-000000000002');
select public.bootstrap_workspace('Firm B', 'admin', 'Building B', 'Manager B');
select set_config('test.b', (select id::text from public.buildings where name = 'Building B'), true);

-- Fixtures written as the test owner, as the ingestion job would write them. Each document has one chunk with the
-- same keyword, so scoping, not wording, decides what is returned.
do $$
declare
  vec text := '[' || array_to_string(array_fill(0.01::real, array[1024]), ',') || ']';
  a uuid := current_setting('test.a')::uuid;
  b uuid := current_setting('test.b')::uuid;
  d uuid;
begin
  -- A: a document in review (not yet confirmed)
  insert into public.documents (id, building_id, title, type, storage_path, uploaded_by, status, byte_size, effective_date)
  values ('93000000-0000-4000-8000-0000000000a1', a, 'Pet rules', 'rules', 'x/a1/source.txt', '93000000-0000-4000-8000-000000000001', 'review', 10, current_date - 30);
  insert into public.document_chunks (document_id, building_id, chunk_index, content, embedding, effective_date)
  values ('93000000-0000-4000-8000-0000000000a1', a, 0, 'Pets are limited to two per unit under the pet rules.', vec::public.vector, current_date - 30);
  -- B: a confirmed document with a distinct keyword
  insert into public.documents (id, building_id, title, type, storage_path, uploaded_by, status, byte_size, effective_date)
  values ('93000000-0000-4000-8000-0000000000b1', b, 'Pet rules B', 'rules', 'x/b1/source.txt', '93000000-0000-4000-8000-000000000002', 'ready', 10, current_date - 30);
  insert into public.document_chunks (document_id, building_id, chunk_index, content, embedding, effective_date)
  values ('93000000-0000-4000-8000-0000000000b1', b, 0, 'Pets are limited to one per unit under the building B rules.', vec::public.vector, current_date - 30);
  -- A: confirmed but not yet in force (effective next year)
  insert into public.documents (id, building_id, title, type, storage_path, uploaded_by, status, byte_size, effective_date)
  values ('93000000-0000-4000-8000-0000000000a2', a, 'Future pet rules', 'rules', 'x/a2/source.txt', '93000000-0000-4000-8000-000000000001', 'ready', 10, current_date + 365);
  insert into public.document_chunks (document_id, building_id, chunk_index, content, embedding, effective_date)
  values ('93000000-0000-4000-8000-0000000000a2', a, 0, 'Pets are limited to none per unit under the future rules.', vec::public.vector, current_date + 365);
  -- A: superseded by a later version that is already in force, so the old one is no longer in force
  insert into public.documents (id, building_id, title, type, storage_path, uploaded_by, status, byte_size, effective_date, effective_until)
  values ('93000000-0000-4000-8000-0000000000a3', a, 'Old pet rules', 'rules', 'x/a3/source.txt', '93000000-0000-4000-8000-000000000001', 'ready', 10, current_date - 900, current_date - 60);
  insert into public.document_chunks (document_id, building_id, chunk_index, content, embedding, effective_date)
  values ('93000000-0000-4000-8000-0000000000a3', a, 0, 'Pets are limited to three per unit under the old pet rules.', vec::public.vector, current_date - 900);
  -- A: deleted
  insert into public.documents (id, building_id, title, type, storage_path, uploaded_by, status, byte_size, effective_date, deleted_at)
  values ('93000000-0000-4000-8000-0000000000a4', a, 'Deleted pet rules', 'rules', 'x/a4/source.txt', '93000000-0000-4000-8000-000000000001', 'ready', 10, current_date - 30, now());
  insert into public.document_chunks (document_id, building_id, chunk_index, content, embedding, effective_date)
  values ('93000000-0000-4000-8000-0000000000a4', a, 0, 'Pets are limited to five per unit under the deleted rules.', vec::public.vector, current_date - 30);
end $$;

-- Manager A's query embedding matches every fixture; only scoping and status decide the result.
create or replace function pg_temp.q(building uuid) returns table(content text)
language sql stable as $$
  select content from public.hybrid_search_building(building, 'pets limited per unit',
    ('[' || array_to_string(array_fill(0.01::real, array[1024]), ',') || ']')::public.vector, null, null, '{}', 30)
$$;

select pg_temp.as_user('93000000-0000-4000-8000-000000000001');
set local role authenticated;

-- 1. A document still in review is not retrievable by Ask.
select is((select count(*)::int from pg_temp.q(current_setting('test.a')::uuid) where content like '%unit under the pet rules%'), 0,
  'a document in review is not retrieved');
reset role;

-- 2. The building manager confirms the detected structure; the document becomes ready and is retrieved.
select pg_temp.as_user('93000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select public.confirm_document_structure('93000000-0000-4000-8000-0000000000a1')$$, 'the uploader confirms the structure');
select is((select count(*)::int from pg_temp.q(current_setting('test.a')::uuid) where content like '%two per unit under the pet rules%'), 1,
  'a confirmed document in force is retrieved for its own building');
select is((select count(*)::int from pg_temp.q(current_setting('test.a')::uuid) where content like '%future rules%'), 0,
  'a document not yet in force is not retrieved');
select is((select count(*)::int from pg_temp.q(current_setting('test.a')::uuid) where content like '%old pet rules%'), 0,
  'a superseded document is not retrieved');
select is((select count(*)::int from pg_temp.q(current_setting('test.a')::uuid) where content like '%deleted rules%'), 0,
  'a deleted document is not retrieved');

-- 3. Direct-ID attempts: manager A asks for building B's id, and gets nothing.
select is((select count(*)::int from pg_temp.q(current_setting('test.b')::uuid)), 0,
  'manager A cannot retrieve building B by its id');
reset role;

-- 4. Manager B asks for building A's id, and gets nothing; B's own confirmed document is retrieved by B.
select pg_temp.as_user('93000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from pg_temp.q(current_setting('test.a')::uuid)), 0,
  'manager B cannot retrieve building A by its id');
select is((select count(*)::int from pg_temp.q(current_setting('test.b')::uuid) where content like '%building B rules%'), 1,
  'manager B retrieves building B''s own confirmed document');
reset role;

-- 5. Cross-building writes: manager B cannot confirm or upload into building A.
select pg_temp.as_user('93000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok($$select public.confirm_document_structure('93000000-0000-4000-8000-0000000000a1')$$, 'P0001', 'forbidden',
  'manager B cannot confirm a document in building A');
select throws_ok(format($$insert into public.documents (building_id, title, type, storage_path, uploaded_by, byte_size) values (%L, 'Injected', 'rules', 'x/inj', %L, 10)$$,
  current_setting('test.a'), '93000000-0000-4000-8000-000000000002'), '42501', null,
  'manager B cannot insert a document into building A');
reset role;

-- 6. Direct reads and writes against building A's rows, as manager B, see nothing and change nothing.
select pg_temp.as_user('93000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.documents where building_id = current_setting('test.a')::uuid), 0,
  'manager B cannot read building A documents by id');
select is((select count(*)::int from public.document_chunks where building_id = current_setting('test.a')::uuid), 0,
  'manager B cannot read building A passages by id');
update public.documents set title = 'Hijacked' where id = '93000000-0000-4000-8000-0000000000a1';
reset role;
-- RLS filters the update to zero rows silently, so the check reads the row as the owner.
select is((select title from public.documents where id = '93000000-0000-4000-8000-0000000000a1'), 'Pet rules',
  'manager B cannot change a building A document');

-- 7. Effective dates: a question asked as of an earlier date is answered from the version in force then.
select pg_temp.as_user('93000000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.hybrid_search_building(current_setting('test.a')::uuid, 'pets limited per unit',
  ('[' || array_to_string(array_fill(0.01::real, array[1024]), ',') || ']')::public.vector, null, current_date - 100, '{}', 30)
  where content like '%old pet rules%'), 1, 'as of an earlier date, the then-in-force version is retrieved');
reset role;

select * from finish();
rollback;

