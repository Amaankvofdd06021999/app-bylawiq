-- The legal corpus is shared and read-only to users, so it has no per-building isolation to prove.
-- What it does have to prove is point-in-time correctness: once a section is amended, the old text
-- must stop being retrievable for today's questions, or an answer will cite law that no longer
-- applies. That guarantee lives in hybrid_search_legal's in_force_from/in_force_to filter, and
-- scripts/ingest-kb.ts depends on it when it sets in_force_to on a superseded source.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(9);

-- A unit vector of the right dimension. Cosine distance to itself is 0, which is inside the
-- function's 0.8 cut-off, so the semantic arm matches and the test does not depend on text search.
select set_config('test.vec',(select '['||string_agg('0.01',',')||']' from generate_series(1,1024)),true);

insert into public.jurisdictions(name,level,code,coverage)
 values ('pgTAP British Columbia','provincial','pgtap-bc','full');
select set_config('test.j',(select id::text from public.jurisdictions where code='pgtap-bc'),true);

-- Three sources: the text in force now, the version it replaced, and one never verified.
insert into public.legal_sources(jurisdiction_id,type,title,citation,kb_id,kb_version,in_force_from,in_force_to,verified_at,supersedes_kb_id) values
 (current_setting('test.j')::uuid,'statute','Maximum fines, current','pgTAP SPA s 132','pgtap.spa.s132','0.7.0','2026-01-01'::date,null,now(),'pgtap.spa.s132.2020-01-01'),
 (current_setting('test.j')::uuid,'statute','Maximum fines, replaced','pgTAP SPA s 132 (2020)','pgtap.spa.s132.2020-01-01','0.6.0','2020-01-01'::date,'2026-01-01'::date,now(),null),
 (current_setting('test.j')::uuid,'statute','Maximum fines, unverified','pgTAP SPA s 132 (draft)','pgtap.spa.s132.unverified','0.7.0','2020-01-01'::date,null,null,null);

insert into public.legal_chunks(source_id,content,section_ref,heading,embedding)
 select id,'pgtapfine the maximum fine for a contravention of a bylaw','Section 132','Maximum fines',current_setting('test.vec')::public.vector(1024)
 from public.legal_sources where kb_id like 'pgtap.spa.s132%';

-- The upsert key scripts/ingest-kb.ts relies on: a second row for the same kb item must be rejected
-- rather than quietly duplicating the source.
select throws_ok(
 $$insert into public.legal_sources(jurisdiction_id,type,title,citation,kb_id)
   values (current_setting('test.j')::uuid,'statute','Duplicate','pgTAP dup','pgtap.spa.s132')$$,
 '23505','a kb id cannot be loaded twice');

set local role authenticated;

-- Today: only the current version is retrievable.
select is((select count(*)::integer from public.hybrid_search_legal('pgtapfine',current_setting('test.vec')::public.vector(1024)) where citation='pgTAP SPA s 132'),1,
 'the text in force today is retrievable');
select is((select count(*)::integer from public.hybrid_search_legal('pgtapfine',current_setting('test.vec')::public.vector(1024)) where citation='pgTAP SPA s 132 (2020)'),0,
 'a superseded version is not retrievable for a question about today');
select is((select count(*)::integer from public.hybrid_search_legal('pgtapfine',current_setting('test.vec')::public.vector(1024)) where citation='pgTAP SPA s 132 (draft)'),0,
 'an unverified source is never retrievable');

-- As of a date inside the old version's life: the old text, and only the old text.
select is((select count(*)::integer from public.hybrid_search_legal('pgtapfine',current_setting('test.vec')::public.vector(1024),'{}'::uuid[],'2022-06-01'::date) where citation='pgTAP SPA s 132 (2020)'),1,
 'a superseded version is retrievable for a question asked as of a date when it applied');
select is((select count(*)::integer from public.hybrid_search_legal('pgtapfine',current_setting('test.vec')::public.vector(1024),'{}'::uuid[],'2022-06-01'::date) where citation='pgTAP SPA s 132'),0,
 'the current text is not retrievable for a date before it came into force');

-- The kb version travels with the row, so an answer can be traced to the corpus it used.
select is((select kb_version from public.hybrid_search_legal('pgtapfine',current_setting('test.vec')::public.vector(1024)) where citation='pgTAP SPA s 132'),'0.7.0',
 'the search returns the kb version of each source');

reset role;

-- Recreating the function must not hand execute back to anon (20260914092559_trusted_writes.sql).
select is(has_function_privilege('anon','public.hybrid_search_legal(text,public.vector,uuid[],date,integer)','execute'),false,
 'anon cannot execute the legal search');
select is(has_function_privilege('authenticated','public.hybrid_search_legal(text,public.vector,uuid[],date,integer)','execute'),true,
 'authenticated can execute the legal search');

select * from finish();
rollback;
