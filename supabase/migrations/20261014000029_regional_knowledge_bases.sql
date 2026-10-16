-- supabase/migrations/20261014_regional_knowledge_bases.sql
-- Phase 6: Regional Knowledge Bases
-- Multi-tier knowledge base system: Regional â†’ Universal KB (platform admin only)

-- Regional knowledge base definitions
create table public.regional_knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  region_name text not null unique, -- e.g., "British Columbia"
  jurisdiction text not null, -- e.g., "BC"
  country text not null default 'Canada',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index regional_knowledge_bases_jurisdiction_idx on public.regional_knowledge_bases(jurisdiction);
create index regional_knowledge_bases_country_idx on public.regional_knowledge_bases(country);

-- Link buildings to regions
create table public.building_regions (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  region_id uuid not null references public.regional_knowledge_bases(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(building_id, region_id)
);

create index building_regions_building_idx on public.building_regions(building_id);
create index building_regions_region_idx on public.building_regions(region_id);

-- RLS: Only platform admin can access regional KBs
alter table public.regional_knowledge_bases enable row level security;
alter table public.building_regions enable row level security;

create policy regional_kb_platform_admin_read on public.regional_knowledge_bases
  for select to authenticated
  using(
    exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

create policy regional_kb_platform_admin_write on public.regional_knowledge_bases
  for update to authenticated
  using(
    exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

create policy building_regions_platform_admin_read on public.building_regions
  for select to authenticated
  using(
    exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

create policy building_regions_platform_admin_write on public.building_regions
  for all to authenticated
  using(
    exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

-- RPC: Get region statistics
create or replace function public.get_region_stats(p_region_id uuid)
returns table(
  region_name text,
  jurisdiction text,
  building_count int,
  document_count int,
  chunk_count int,
  legal_chunk_count int,
  last_updated timestamptz
) language plpgsql security definer set search_path='' as $$
begin
  -- Verify platform admin
  if not exists(
    select 1 from public.org_members om
    where om.user_id = auth.uid()
    and om.role = 'platform_admin'
    and om.status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  return query
  select
    rkb.region_name,
    rkb.jurisdiction,
    (select count(*) from public.building_regions br where br.region_id = p_region_id)::int as building_count,
    (
      select count(*) from public.documents d
      join public.building_regions br on br.building_id = d.building_id
      where br.region_id = p_region_id
    )::int as document_count,
    (
      select count(*) from public.document_chunks dc
      join public.documents d on d.id = dc.document_id
      join public.building_regions br on br.building_id = d.building_id
      where br.region_id = p_region_id
    )::int as chunk_count,
    (
      select count(*) from public.legal_chunks lc
      where lc.jurisdiction = rkb.jurisdiction
    )::int as legal_chunk_count,
    (
      select max(updated_at) from public.document_chunks dc
      join public.documents d on d.id = dc.document_id
      join public.building_regions br on br.building_id = d.building_id
      where br.region_id = p_region_id
    ) as last_updated
  from public.regional_knowledge_bases rkb
  where rkb.id = p_region_id;
end; $$;

-- RPC: Search regional knowledge base
create or replace function public.search_regional_kb(
  p_region_id uuid,
  p_query text,
  p_limit int default 20
)
returns table(
  chunk_id uuid,
  document_id uuid,
  document_title text,
  building_name text,
  content text,
  chunk_type text,
  relevance_score float
) language plpgsql security definer set search_path='' as $$
declare
  v_query_tsvector tsvector;
  v_jurisdiction text;
begin
  -- Verify platform admin
  if not exists(
    select 1 from public.org_members om
    where om.user_id = auth.uid()
    and om.role = 'platform_admin'
    and om.status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  -- Get jurisdiction for this region
  select jurisdiction into v_jurisdiction from public.regional_knowledge_bases where id = p_region_id;
  if v_jurisdiction is null then
    raise exception 'Region not found' using errcode = 'P0002';
  end if;

  v_query_tsvector := to_tsvector('english', p_query);

  -- Search building documents in region
  return query
  (select
    dc.id,
    d.id,
    d.title,
    b.name,
    dc.content,
    'building_document'::text,
    (ts_rank(dc.tsvector, v_query_tsvector))::float
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  join public.buildings b on b.id = d.building_id
  join public.building_regions br on br.building_id = b.id
  where br.region_id = p_region_id
  and dc.tsvector @@ v_query_tsvector
  order by ts_rank(dc.tsvector, v_query_tsvector) desc
  limit (p_limit / 2)::int)

  union all

  -- Search legal corpus for jurisdiction
  (select
    lc.id,
    null::uuid,
    lc.title,
    v_jurisdiction,
    lc.content,
    'legal_corpus'::text,
    (ts_rank(lc.tsvector, v_query_tsvector))::float
  from public.legal_chunks lc
  where lc.jurisdiction = v_jurisdiction
  and lc.tsvector @@ v_query_tsvector
  order by ts_rank(lc.tsvector, v_query_tsvector) desc
  limit (p_limit / 2)::int);
end; $$;

-- RPC: Search universal knowledge base (all regions)
create or replace function public.search_universal_kb(
  p_query text,
  p_limit int default 20
)
returns table(
  chunk_id uuid,
  document_id uuid,
  document_title text,
  region_name text,
  building_name text,
  content text,
  chunk_type text,
  relevance_score float
) language plpgsql security definer set search_path='' as $$
declare
  v_query_tsvector tsvector;
begin
  -- Verify platform admin
  if not exists(
    select 1 from public.org_members om
    where om.user_id = auth.uid()
    and om.role = 'platform_admin'
    and om.status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  v_query_tsvector := to_tsvector('english', p_query);

  -- Search all building documents with region info
  return query
  select
    dc.id,
    d.id,
    d.title,
    rkb.region_name,
    b.name,
    dc.content,
    'building_document'::text,
    (ts_rank(dc.tsvector, v_query_tsvector))::float
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  join public.buildings b on b.id = d.building_id
  join public.building_regions br on br.building_id = b.id
  join public.regional_knowledge_bases rkb on rkb.id = br.region_id
  where dc.tsvector @@ v_query_tsvector
  order by ts_rank(dc.tsvector, v_query_tsvector) desc
  limit (p_limit * 2)::int;
end; $$;

-- RPC: Get all regions
create or replace function public.get_all_regions()
returns table(
  id uuid,
  region_name text,
  jurisdiction text,
  building_count int,
  document_count int
) language plpgsql security definer set search_path='' as $$
begin
  -- Verify platform admin
  if not exists(
    select 1 from public.org_members om
    where om.user_id = auth.uid()
    and om.role = 'platform_admin'
    and om.status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  return query
  select
    rkb.id,
    rkb.region_name,
    rkb.jurisdiction,
    (select count(*) from public.building_regions br where br.region_id = rkb.id)::int,
    (
      select count(*) from public.documents d
      join public.building_regions br on br.building_id = d.building_id
      where br.region_id = rkb.id
    )::int
  from public.regional_knowledge_bases rkb
  order by rkb.region_name;
end; $$;

-- Seed initial regions
insert into public.regional_knowledge_bases (region_name, jurisdiction, country, description) values
  ('British Columbia', 'BC', 'Canada', 'British Columbia strata property knowledge base'),
  ('Alberta', 'AB', 'Canada', 'Alberta property law knowledge base'),
  ('Ontario', 'ON', 'Canada', 'Ontario condo corporation knowledge base'),
  ('Quebec', 'QC', 'Canada', 'Quebec co-ownership knowledge base'),
  ('Manitoba', 'MB', 'Canada', 'Manitoba property knowledge base'),
  ('Saskatchewan', 'SK', 'Canada', 'Saskatchewan property knowledge base')
on conflict (region_name) do nothing;

grant execute on function public.get_region_stats to authenticated;
grant execute on function public.search_regional_kb to authenticated;
grant execute on function public.search_universal_kb to authenticated;
grant execute on function public.get_all_regions to authenticated;
grant select on table public.regional_knowledge_bases to authenticated;
grant select on table public.building_regions to authenticated;
