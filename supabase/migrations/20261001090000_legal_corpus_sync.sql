-- Legal corpus sync.
--
-- Two problems this fixes.
--
-- 1. The shared legal corpus could not be refreshed. legal_sources had no stable key from the
--    knowledge base, so re-running scripts/ingest-kb.ts inserted duplicate sources instead of
--    updating them (kb/research/open-questions.md, question 6). kb_id is that key, and
--    content_sha256 lets a refresh skip re-embedding a source whose text has not changed.
--
-- 2. An answer could not be traced to the legislation version it was built from.
--    buildings.corpus_version covers the building's own documents and is already recorded on every
--    retrieval trace; nothing covered the legal corpus. So when a section is amended there was no
--    way to find the answers, or the notices sent to residents, that relied on the old text.
--    legal_kb_versions closes that.
--
-- Supersession works through columns that already exist. hybrid_search_legal filters on
-- in_force_from and in_force_to against p_as_of, so an old version of a section stops being
-- retrievable for today's questions the moment its in_force_to is set, while remaining retrievable
-- for a question asked "as of" a past date. supersedes_kb_id records which version replaced it.
--
-- Rollback:
--   drop index public.legal_sources_supersedes_idx;
--   drop index public.legal_sources_kb_id_idx;
--   alter table public.legal_sources
--     drop column kb_id, drop column kb_version, drop column supersedes_kb_id, drop column content_sha256;
--   alter table public.retrieval_traces drop column legal_kb_versions;
--   drop function public.hybrid_search_legal(text,public.vector,uuid[],date,integer);
--   then recreate hybrid_search_legal from 20260914092517_members_and_retrieval.sql and re-apply
--   the revoke/grant pair at the end of this file.

alter table public.legal_sources
 add column kb_id text,
 add column kb_version text,
 add column supersedes_kb_id text,
 add column content_sha256 text;

comment on column public.legal_sources.kb_id is
 'Stable knowledge-base item id (kb/README.md). scripts/ingest-kb.ts upserts on it, so a corpus refresh updates a source instead of duplicating it.';
comment on column public.legal_sources.kb_version is
 'kb package version that last wrote this row. Recorded on retrieval_traces.legal_kb_versions so an answer can be traced to the corpus it used.';
comment on column public.legal_sources.supersedes_kb_id is
 'kb id of the version this row replaces. Read with in_force_to on the replaced row: that pair is how a point-in-time question finds the text that applied on a past date.';
comment on column public.legal_sources.content_sha256 is
 'Hash of the chunk content last loaded for this source. A refresh skips re-embedding when it is unchanged; re-embedding the corpus is slow and costs money (AGENTS.md section 5).';

-- Partial unique index: the upsert key. Rows loaded before this migration have no kb_id and are
-- left alone rather than being guessed at.
create unique index legal_sources_kb_id_idx on public.legal_sources(kb_id) where kb_id is not null;
create index legal_sources_supersedes_idx on public.legal_sources(supersedes_kb_id) where supersedes_kb_id is not null;

alter table public.retrieval_traces add column legal_kb_versions text[] not null default '{}';
comment on column public.retrieval_traces.legal_kb_versions is
 'kb versions of the legal sources this answer actually used, alongside corpus_versions for the building corpus. Lets an amendment be traced back to the answers that relied on the old text.';

-- Returns kb_version so features/chat/retrieval.ts can record it. Otherwise unchanged from
-- 20260914092517_members_and_retrieval.sql: a function's OUT columns cannot be altered in place.
drop function public.hybrid_search_legal(text,public.vector,uuid[],date,integer);
create function public.hybrid_search_legal(p_query_text text,p_query_embedding public.vector(1024),p_jurisdictions uuid[] default '{}',p_as_of date default null,p_limit integer default 30)
returns table(chunk_id uuid,source_id uuid,content text,heading text,section_ref text,title text,citation text,url text,effective_date date,kb_version text,score double precision)
language sql stable security invoker set search_path=public as $$
 with eligible as (
 select c.*,s.title,s.citation,s.url,s.in_force_from,s.kb_version from public.legal_chunks c join public.legal_sources s on s.id=c.source_id
 join public.jurisdictions j on j.id=s.jurisdiction_id where s.verified_at is not null
 and (j.level in ('federal','provincial') or s.jurisdiction_id=any(p_jurisdictions))
 and (s.in_force_from is null or s.in_force_from<=coalesce(p_as_of,current_date)) and (s.in_force_to is null or s.in_force_to>coalesce(p_as_of,current_date))
 ), sem as(select id,row_number() over(order by embedding<=>p_query_embedding) r from eligible where embedding<=>p_query_embedding<0.8 order by embedding<=>p_query_embedding limit 40),
 kw as(select id,row_number() over(order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc) r from eligible where tsv@@websearch_to_tsquery('english',p_query_text) order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc limit 40)
 select e.id,e.source_id,e.content,e.heading,e.section_ref,e.title,e.citation,e.url,e.in_force_from,e.kb_version,(coalesce(1.0/(60+s.r),0)+coalesce(1.0/(60+k.r),0))::double precision score
 from eligible e left join sem s on s.id=e.id left join kw k on k.id=e.id where s.id is not null or k.id is not null order by score desc limit least(p_limit,40);
$$;

-- A newly created function is executable by PUBLIC by default, and 20260914092559_trusted_writes.sql
-- revoked that for every function then in existence. Re-apply it for this one.
revoke execute on function public.hybrid_search_legal(text,public.vector,uuid[],date,integer) from public,anon;
grant execute on function public.hybrid_search_legal(text,public.vector,uuid[],date,integer) to authenticated;
