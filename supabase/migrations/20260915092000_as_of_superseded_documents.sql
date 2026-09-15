-- As-of retrieval returned every superseded document once any as-of date was set, so a replaced bylaw was cited
-- alongside its replacement unless effective_until had been filled in by hand. A superseded document is now
-- eligible only for dates before its replacement took effect; if the replacement has no effective date the
-- changeover cannot be placed, so the old text is left out rather than guessed.
create or replace function public.hybrid_search_building(p_building_id uuid,p_query_text text,p_query_embedding public.vector(1024),p_kb uuid default null,p_as_of date default null,p_types text[] default '{}',p_limit integer default 30)
returns table(chunk_id uuid,document_id uuid,building_id uuid,content text,heading text,section_ref text,page_from integer,effective_date date,title text,score double precision)
language sql stable security invoker set search_path=public as $$
 with eligible as (
  select c.*,d.title from public.document_chunks c join public.documents d on d.id=c.document_id
  where c.building_id=p_building_id and d.deleted_at is null and d.status='ready'
  and (p_kb is null or d.knowledge_base_id=p_kb) and (cardinality(p_types)=0 or d.type=any(p_types))
  and (d.effective_date is null or d.effective_date<=coalesce(p_as_of,current_date))
  and (d.effective_until is null or d.effective_until>coalesce(p_as_of,current_date))
  and (d.superseded_by is null or (p_as_of is not null and exists(select 1 from public.documents n where n.id=d.superseded_by and n.effective_date is not null and p_as_of<n.effective_date)))
 ), sem as (
  select id,row_number() over(order by embedding<=>p_query_embedding) r from eligible where embedding<=>p_query_embedding<0.8 order by embedding<=>p_query_embedding limit 40
 ), kw as (
  select id,row_number() over(order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc) r from eligible where tsv@@websearch_to_tsquery('english',p_query_text) order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc limit 40
 ) select e.id,e.document_id,e.building_id,e.content,e.heading,e.section_ref,e.page_from,e.effective_date,e.title,
 (coalesce(1.0/(60+s.r),0)+coalesce(1.0/(60+k.r),0))::double precision score
 from eligible e left join sem s on s.id=e.id left join kw k on k.id=e.id where s.id is not null or k.id is not null order by score desc limit least(p_limit,40);
$$;
