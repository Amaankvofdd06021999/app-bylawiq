-- Firm knowledge search: text-only ranking. The previous definition compared pgvector values (`<=>`) inside its
-- embedding branch. That branch never runs, but PL/pgSQL still resolves the operator, and with search_path set to ''
-- the pgvector operator is not visible, so every search failed. Embeddings are not in use yet (see the TODO in
-- 20261010000021_firm_knowledge.sql), so this version keeps the same signature and ranks with ts_rank only.
-- The membership check and the building filter are unchanged.
--
-- Rollback: re-apply the previous definition of public.search_firm_knowledge(uuid, text, integer, uuid) from
-- 20261010000021_firm_knowledge.sql. No table or column changes.

create or replace function public.search_firm_knowledge(
  p_firm_id uuid,
  p_query text,
  p_limit integer default 10,
  p_building_id uuid default null
)
returns table(
  document_id uuid,
  chunk_id uuid,
  chunk_index integer,
  content text,
  rank double precision,
  kind text,
  title text
)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_query_tsvector tsquery;
begin
  if not exists (
    select 1 from public.org_members
    where org_id = p_firm_id and user_id = (select auth.uid()) and status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a member of this firm';
  end if;

  v_query_tsvector := plainto_tsquery('english', p_query);

  return query
  select
    fc.document_id,
    fc.id,
    fc.chunk_index,
    fc.content,
    ts_rank(fc.tsvector_idx, v_query_tsvector)::double precision as rank,
    fd.doc_kind,
    fd.title
  from public.firm_document_chunks fc
  join public.firm_documents fd on fd.id = fc.document_id
  where
    fc.firm_id = p_firm_id
    and fd.published_at is not null
    and (p_building_id is null or p_building_id = any(fd.applies_to_buildings) or fd.applies_to_buildings = '{}')
    and fc.tsvector_idx @@ v_query_tsvector
  order by rank desc
  limit p_limit;
end;
$$;
