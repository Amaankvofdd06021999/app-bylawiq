-- Migration 70: Quarantine unverified draft legislation in legal_sources and restrict hybrid_search_legal
-- Ensures only approved/reviewed legal sources with verified_at are retrievable by users.

alter table public.legal_sources
  add column if not exists status text not null default 'approved' check (status in ('draft', 'reviewed', 'approved'));

comment on column public.legal_sources.status is
  'Review status of legal source (draft, reviewed, approved). Only approved or reviewed sources with verified_at not null can be retrieved by hybrid_search_legal.';

-- Quarantine unvetted 0.8.0 drafts in the live database
update public.legal_sources
  set status = 'draft', verified_at = null
  where kb_version = '0.8.0';

-- Recreate hybrid_search_legal to enforce status in ('approved', 'reviewed')
drop function if exists public.hybrid_search_legal(text,public.vector,uuid[],date,integer);

create function public.hybrid_search_legal(
  p_query_text text,
  p_query_embedding public.vector(1024),
  p_jurisdictions uuid[] default '{}',
  p_as_of date default null,
  p_limit integer default 30
)
returns table(
  chunk_id uuid,
  source_id uuid,
  content text,
  heading text,
  section_ref text,
  title text,
  citation text,
  url text,
  effective_date date,
  kb_version text,
  score double precision
)
language sql stable security invoker set search_path=public as $$
  with eligible as (
    select c.*,s.title,s.citation,s.url,s.in_force_from,s.kb_version
    from public.legal_chunks c
    join public.legal_sources s on s.id=c.source_id
    join public.jurisdictions j on j.id=s.jurisdiction_id
    where s.verified_at is not null
      and s.status in ('approved', 'reviewed')
      and (j.level in ('federal','provincial') or s.jurisdiction_id=any(p_jurisdictions))
      and (s.in_force_from is null or s.in_force_from<=coalesce(p_as_of,current_date))
      and (s.in_force_to is null or s.in_force_to>coalesce(p_as_of,current_date))
  ),
  sem as (
    select id, row_number() over(order by embedding<=>p_query_embedding) r
    from eligible
    where embedding<=>p_query_embedding < 0.8
    order by embedding<=>p_query_embedding
    limit 40
  ),
  kw as (
    select id, row_number() over(order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc) r
    from eligible
    where tsv@@websearch_to_tsquery('english',p_query_text)
    order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc
    limit 40
  )
  select e.id,e.source_id,e.content,e.heading,e.section_ref,e.title,e.citation,e.url,e.in_force_from,e.kb_version,
         (coalesce(1.0/(60+s.r),0)+coalesce(1.0/(60+k.r),0))::double precision score
  from eligible e
  left join sem s on s.id=e.id
  left join kw k on k.id=e.id
  where s.id is not null or k.id is not null
  order by score desc
  limit least(p_limit,40);
$$;

revoke execute on function public.hybrid_search_legal(text,public.vector,uuid[],date,integer) from public,anon;
grant execute on function public.hybrid_search_legal(text,public.vector,uuid[],date,integer) to authenticated;
