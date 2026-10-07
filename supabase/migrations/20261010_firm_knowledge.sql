-- supabase/migrations/20261010_firm_knowledge.sql
-- Phase 4: Firm knowledge management system
--
-- Enables strata firms to:
-- 1. Upload and organize documents across buildings
-- 2. Search documents using hybrid search (BM25 + embeddings)
-- 3. Share knowledge across a portfolio of linked buildings
-- 4. Track document usage and reach
--
-- Tables:
-- - firm_documents: Documents uploaded by firms (templates, policies, research)
-- - firm_document_chunks: Embedded chunks for hybrid search
-- - firm_knowledge_stats: Usage tracking per building
--
-- Rollback: drop table public.firm_knowledge_stats; drop table public.firm_document_chunks; drop table public.firm_documents;

create table public.firm_documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.organizations(id) on delete cascade,

  title text not null,
  description text,
  doc_kind text not null check(doc_kind in ('template', 'policy', 'precedent', 'research', 'guide')),
  content_hash text not null, -- SHA256 hash for dedup

  -- Metadata
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Availability
  published_at timestamptz, -- null = draft, set = live
  applies_to_buildings uuid[] default '{}', -- optional: restrict to specific buildings

  -- Stats
  view_count integer not null default 0,
  used_count integer not null default 0, -- times cited in answers

  unique(firm_id, content_hash)
);

create index firm_documents_firm_idx on public.firm_documents(firm_id, published_at desc);
create index firm_documents_kind_idx on public.firm_documents(doc_kind, published_at desc);
create index firm_documents_created_idx on public.firm_documents(created_by, created_at desc);

-- Chunks for hybrid search (BM25 + embeddings)
create table public.firm_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.firm_documents(id) on delete cascade,
  firm_id uuid not null references public.organizations(id) on delete cascade,

  -- Content
  chunk_index integer not null,
  content text not null,

  -- Embeddings (pgvector)
  embedding vector(1536),

  -- Search
  tsvector_idx tsvector generated always as (to_tsvector('english', content)) stored,

  created_at timestamptz not null default now()
);

create index firm_document_chunks_document_idx on public.firm_document_chunks(document_id);
create index firm_document_chunks_firm_idx on public.firm_document_chunks(firm_id);
create index firm_document_chunks_embedding_idx on public.firm_document_chunks using ivfflat(embedding vector_cosine_ops);
create index firm_document_chunks_tsvector_idx on public.firm_document_chunks using gist(tsvector_idx);

-- Track which buildings have viewed/used firm knowledge
create table public.firm_knowledge_stats (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.firm_documents(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,

  view_count integer not null default 0,
  used_count integer not null default 0, -- times cited

  last_viewed_at timestamptz,
  last_used_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(document_id, building_id)
);

create index firm_knowledge_stats_building_idx on public.firm_knowledge_stats(building_id, last_viewed_at desc);
create index firm_knowledge_stats_document_idx on public.firm_knowledge_stats(document_id);

-- RLS Policies
alter table public.firm_documents enable row level security;
alter table public.firm_document_chunks enable row level security;
alter table public.firm_knowledge_stats enable row level security;

-- Firm owners/admins can manage their own firm's documents
create policy firm_docs_read on public.firm_documents
  for select to authenticated
  using(
    -- Published docs: accessible to firm staff
    (published_at is not null and firm_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and status = 'active'
    ))
    -- Draft docs: only creator and firm owners
    or (published_at is null and (
      created_by = auth.uid() or
      firm_id in (
        select org_id from public.org_members
        where user_id = auth.uid() and role in ('org_owner', 'org_admin') and status = 'active'
      )
    ))
  );

create policy firm_docs_insert on public.firm_documents
  for insert to authenticated
  with check(
    firm_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('org_owner', 'org_admin', 'portfolio_manager') and status = 'active'
    )
  );

create policy firm_docs_update on public.firm_documents
  for update to authenticated
  using(
    created_by = auth.uid() or
    firm_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('org_owner', 'org_admin') and status = 'active'
    )
  )
  with check(
    firm_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('org_owner', 'org_admin', 'portfolio_manager') and status = 'active'
    )
  );

-- Chunks follow document visibility
create policy firm_chunks_read on public.firm_document_chunks
  for select to authenticated
  using(
    exists(
      select 1 from public.firm_documents
      where id = document_id and public.created_by = auth.uid()
      union all
      select 1 from public.firm_documents
      where id = document_id and published_at is not null and firm_id in (
        select org_id from public.org_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

-- Stats are visible to building managers and firm staff
create policy firm_stats_read on public.firm_knowledge_stats
  for select to authenticated
  using(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid() and status = 'active'
    )
    or exists(
      select 1 from public.firm_documents
      where id = document_id and firm_id in (
        select org_id from public.org_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy firm_stats_update on public.firm_knowledge_stats
  for update to authenticated
  using(
    document_id in (
      select id from public.firm_documents
      where firm_id in (
        select org_id from public.org_members
        where user_id = auth.uid() and role in ('org_owner', 'org_admin') and status = 'active'
      )
    )
  );

-- Function to search firm knowledge using hybrid search (BM25 + similarity)
create or replace function public.search_firm_knowledge(
  p_firm_id uuid,
  p_query text,
  p_limit int default 10,
  p_building_id uuid default null
)
returns table(
  document_id uuid,
  chunk_id uuid,
  chunk_index integer,
  content text,
  rank float8,
  kind text,
  title text
) language plpgsql security definer set search_path='' as $$
declare
  v_embedding vector(1536);
  v_query_tsvector tsvector;
begin
  -- Parse query to tsvector for BM25
  v_query_tsvector := to_tsvector('english', p_query);

  -- TODO: Generate embedding for semantic search (Phase 4 follow-up)
  -- v_embedding := openai_embeddings(p_query);

  return query
  select
    fc.document_id,
    fc.id,
    fc.chunk_index,
    fc.content,
    -- Rank by BM25 relevance (ts_rank) or similarity (if embeddings available)
    case
      when v_embedding is not null then
        -- Hybrid: 40% BM25 + 60% semantic
        0.4 * ts_rank(fc.tsvector_idx, v_query_tsvector) +
        0.6 * (1 - (fc.embedding <=> v_embedding) / 2)
      else
        -- Text-only: full BM25
        ts_rank(fc.tsvector_idx, v_query_tsvector)
    end as rank,
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
end; $$;

-- Function to increment view/use stats
create or replace function public.increment_firm_knowledge_stat(
  p_document_id uuid,
  p_building_id uuid,
  p_stat_type text
)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.firm_knowledge_stats(document_id, building_id)
  values(p_document_id, p_building_id)
  on conflict(document_id, building_id) do update
  set
    view_count = case when p_stat_type = 'view' then firm_knowledge_stats.view_count + 1 else firm_knowledge_stats.view_count end,
    used_count = case when p_stat_type = 'use' then firm_knowledge_stats.used_count + 1 else firm_knowledge_stats.used_count end,
    last_viewed_at = case when p_stat_type = 'view' then now() else firm_knowledge_stats.last_viewed_at end,
    last_used_at = case when p_stat_type = 'use' then now() else firm_knowledge_stats.last_used_at end,
    updated_at = now();
end; $$;

grant execute on function public.search_firm_knowledge to authenticated;
grant execute on function public.increment_firm_knowledge_stat to authenticated;

-- Audit trigger
create trigger audit_firm_documents
after insert or update or delete on public.firm_documents
for each row
execute function public.audit_change();

create trigger audit_firm_knowledge_stats
after update on public.firm_knowledge_stats
for each row
execute function public.audit_change();
