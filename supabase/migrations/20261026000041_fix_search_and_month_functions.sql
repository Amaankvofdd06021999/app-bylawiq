-- Fixes two broken helpers that retrieval calls and silently swallows errors from:
-- 1. Search functions declared the query as tsvector and compared it with tsvector @@ tsvector, which Postgres
--    rejects. The query is now a tsquery (plainto_tsquery), which is what @@ takes. Matching is AND across the
--    query words, the same as plainto_tsquery; widening recall is a ranking follow-up.
-- 2. Month functions turned the month into text with '-01' appended, which fails for the date the app passes.
--    date_trunc('month', p_month) gives the first day of that month.
-- Only the function bodies change. Grants and the guards from 20261025000040 are kept.
-- Rollback: recreate each function from 20261025000040 (or its earlier migration) with the original expressions.

CREATE OR REPLACE FUNCTION public.search_vendor_contracts(p_building_id uuid, p_query text, p_limit integer DEFAULT 10)
 RETURNS TABLE(contract_id uuid, vendor_name text, service_type text, contract_start_date date, contract_end_date date, monthly_cost numeric, annual_cost numeric, status text, relevance_score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query_tsvector tsquery;
begin
  if not public.authorize('chat.use', p_building_id) then raise insufficient_privilege using message = 'forbidden'; end if;
  v_query_tsvector := plainto_tsquery('english', p_query);

  return query
  select
    vc.id,
    vc.vendor_name,
    vc.service_type,
    vc.contract_start_date,
    vc.contract_end_date,
    vc.monthly_cost,
    vc.annual_cost,
    vc.status,
    -- Score by text match + status (active contracts rank higher)
    case
      when vc.status = 'active' then 1.5
      when vc.status = 'expiring' then 1.2
      else 0.8
    end as relevance_score
  from public.vendor_contracts vc
  where vc.building_id = p_building_id
    and (
      to_tsvector('english', vc.vendor_name) @@ v_query_tsvector
      or to_tsvector('english', vc.service_type) @@ v_query_tsvector
      or to_tsvector('english', vc.service_scope) @@ v_query_tsvector
    )
  order by relevance_score desc, vc.contract_start_date desc
  limit p_limit;
end; $function$;

CREATE OR REPLACE FUNCTION public.search_insurance_policies(p_building_id uuid, p_query text, p_limit integer DEFAULT 10)
 RETURNS TABLE(policy_id uuid, policy_type text, provider_name text, policy_number text, coverage_amount numeric, deductible numeric, policy_start_date date, policy_end_date date, status text, relevance_score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query_tsvector tsquery;
begin
  if not public.authorize('chat.use', p_building_id) then raise insufficient_privilege using message = 'forbidden'; end if;
  v_query_tsvector := plainto_tsquery('english', p_query);

  return query
  select
    ip.id,
    ip.policy_type,
    ip.provider_name,
    ip.policy_number,
    ip.coverage_amount,
    ip.deductible,
    ip.policy_start_date,
    ip.policy_end_date,
    ip.status,
    -- Score by type match + status (active policies rank higher)
    case
      when ip.status = 'active' then 1.5
      when ip.status = 'expiring' then 1.2
      else 0.8
    end as relevance_score
  from public.insurance_policies ip
  where ip.building_id = p_building_id
    and (
      to_tsvector('english', ip.policy_type) @@ v_query_tsvector
      or to_tsvector('english', ip.provider_name) @@ v_query_tsvector
      or to_tsvector('english', ip.coverage_type) @@ v_query_tsvector
    )
  order by relevance_score desc, ip.policy_start_date desc
  limit p_limit;
end; $function$;

CREATE OR REPLACE FUNCTION public.search_maintenance_logs(p_building_id uuid, p_query text, p_limit integer DEFAULT 10)
 RETURNS TABLE(log_id uuid, issue_type text, description text, severity text, status text, reported_at timestamp with time zone, resolved_at timestamp with time zone, actual_cost numeric, relevance_score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query_tsvector tsquery;
begin
  if not public.authorize('chat.use', p_building_id) then raise insufficient_privilege using message = 'forbidden'; end if;
  v_query_tsvector := plainto_tsquery('english', p_query);

  return query
  select
    ml.id,
    ml.issue_type,
    ml.description,
    ml.severity,
    ml.status,
    ml.reported_at,
    ml.resolved_at,
    ml.actual_cost,
    -- Score by relevance: text match + recency + severity
    case
      when ml.severity = 'critical' then 1.5
      when ml.severity = 'high' then 1.2
      when ml.severity = 'medium' then 1.0
      else 0.8
    end *
    case
      when ml.status = 'resolved' then 0.8
      else 1.0
    end as relevance_score
  from public.maintenance_logs ml
  where ml.building_id = p_building_id
    and (
      to_tsvector('english', ml.description) @@ v_query_tsvector
      or to_tsvector('english', ml.issue_type) @@ v_query_tsvector
      or to_tsvector('english', ml.location) @@ v_query_tsvector
    )
  order by relevance_score desc, ml.reported_at desc
  limit p_limit;
end; $function$;

CREATE OR REPLACE FUNCTION public.search_regional_kb(p_region_id uuid, p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(chunk_id uuid, document_id uuid, document_title text, building_name text, content text, chunk_type text, relevance_score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query_tsvector tsquery;
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

  v_query_tsvector := plainto_tsquery('english', p_query);

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
end; $function$;

CREATE OR REPLACE FUNCTION public.search_universal_kb(p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(chunk_id uuid, document_id uuid, document_title text, region_name text, building_name text, content text, chunk_type text, relevance_score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query_tsvector tsquery;
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

  v_query_tsvector := plainto_tsquery('english', p_query);

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
end; $function$;

CREATE OR REPLACE FUNCTION public.search_firm_knowledge(p_firm_id uuid, p_query text, p_limit integer DEFAULT 10, p_building_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(document_id uuid, chunk_id uuid, chunk_index integer, content text, rank double precision, kind text, title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_embedding public.vector(1024);
  v_query_tsvector tsquery;
begin
    if not exists(select 1 from public.org_members where org_id = p_firm_id and user_id = auth.uid() and status = 'active') then
      raise insufficient_privilege using message = 'Not a member of this firm';
    end if;
  -- Parse query to tsvector for BM25
  v_query_tsvector := plainto_tsquery('english', p_query);

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
end; $function$;

CREATE OR REPLACE FUNCTION public.compare_building_spending(p_building_ids uuid[], p_month date DEFAULT (CURRENT_DATE - '1 mon'::interval))
 RETURNS TABLE(building_id uuid, building_name text, residents_active integer, questions_asked integer, total_spent_usd numeric, avg_spend_per_resident numeric, ranking integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_month date;
begin
  if exists (select 1 from unnest(p_building_ids) as x(id) where not public.authorize('chat.use', x.id)) then raise insufficient_privilege using message = 'forbidden'; end if;
  v_month := date_trunc('month', p_month)::date;

  return query
  select
    bs.building_id,
    b.name,
    bs.residents_active,
    bs.questions_asked,
    bs.total_spent_usd,
    case
      when bs.residents_active > 0 then bs.total_spent_usd / bs.residents_active
      else 0
    end as avg_spend_per_resident,
    row_number() over (order by bs.total_spent_usd desc) as ranking
  from public.building_spending bs
  join public.buildings b on b.id = bs.building_id
  where bs.building_id = any(p_building_ids)
    and bs.month = v_month
  order by bs.total_spent_usd desc;
end; $function$;

CREATE OR REPLACE FUNCTION public.get_building_spending_summary(p_building_id uuid, p_month date DEFAULT (CURRENT_DATE - '1 mon'::interval))
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
  v_month date;
begin
  if not public.authorize('chat.use', p_building_id) then raise insufficient_privilege using message = 'forbidden'; end if;
  v_month := date_trunc('month', p_month)::date;

  select jsonb_build_object(
    'building_id', p_building_id,
    'month', v_month,
    'residents_active', coalesce(bs.residents_active, 0),
    'questions_asked', coalesce(bs.questions_asked, 0),
    'total_spent_usd', coalesce(bs.total_spent_usd, 0),
    'total_spent_credits', coalesce(bs.total_spent_credits, 0),
    'questions_cost_usd', coalesce(bs.questions_cost_usd, 0),
    'avg_question_cost_usd', coalesce(bs.avg_question_cost_usd, 0),
    'max_spend_resident_usd', coalesce(bs.max_spend_resident_usd, 0)
  ) into v_result
  from public.building_spending bs
  where bs.building_id = p_building_id
    and bs.month = v_month;

  -- Return empty structure if no data
  if v_result is null then
    v_result := jsonb_build_object(
      'building_id', p_building_id,
      'month', v_month,
      'residents_active', 0,
      'questions_asked', 0,
      'total_spent_usd', 0,
      'total_spent_credits', 0,
      'questions_cost_usd', 0,
      'avg_question_cost_usd', 0,
      'max_spend_resident_usd', 0
    );
  end if;

  return v_result;
end; $function$;

CREATE OR REPLACE FUNCTION public.get_org_budget_status(p_org_id uuid, p_month date DEFAULT (CURRENT_DATE - ((((EXTRACT(day FROM CURRENT_DATE) - (1)::numeric))::integer)::double precision * '1 day'::interval)))
 RETURNS TABLE(org_id uuid, month date, monthly_limit_usd numeric, total_spent_usd numeric, pct_spent numeric, remaining_budget numeric, status text, alert_level text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_month date;
begin
  if not exists (select 1 from public.org_members m where m.org_id = p_org_id and m.user_id = auth.uid() and m.status = 'active') then raise insufficient_privilege using message = 'forbidden'; end if;
  v_month := date_trunc('month', p_month)::date;

  return query
  select
    ob.org_id,
    ob.month,
    ob.monthly_limit_usd,
    ob.total_spent_usd,
    ((ob.total_spent_usd / ob.monthly_limit_usd) * 100)::numeric as pct_spent,
    (ob.monthly_limit_usd - ob.total_spent_usd)::numeric as remaining_budget,
    case
      when ob.total_spent_usd >= ob.monthly_limit_usd then 'EXCEEDED'
      when ob.total_spent_usd >= (ob.monthly_limit_usd * 0.8) then 'THRESHOLD_REACHED'
      else 'OK'
    end as status,
    case
      when ob.total_spent_usd >= ob.monthly_limit_usd then 'CRITICAL'
      when ob.total_spent_usd >= (ob.monthly_limit_usd * 0.8) then 'WARNING'
      when ob.total_spent_usd >= (ob.monthly_limit_usd * 0.5) then 'CAUTION'
      else 'HEALTHY'
    end as alert_level
  from public.org_budgets ob
  where ob.org_id = p_org_id
    and ob.month = v_month;
end; $function$;

CREATE OR REPLACE FUNCTION public.get_org_spending_summary(p_org_id uuid, p_month date DEFAULT (CURRENT_DATE - '1 mon'::interval))
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.org_members m where m.org_id = p_org_id and m.user_id = auth.uid() and m.status = 'active') then raise insufficient_privilege using message = 'forbidden'; end if;
  return (
    select jsonb_build_object(
      'org_id', p_org_id,
      'month', date_trunc('month', p_month)::date,
      'total_buildings', count(distinct bs.building_id),
      'total_residents_active', sum(bs.residents_active),
      'total_questions', sum(bs.questions_asked),
      'total_spent_usd', sum(bs.total_spent_usd),
      'avg_spend_per_building', avg(bs.total_spent_usd),
      'highest_spending_building', (
        select json_build_object(
          'building_id', bs2.building_id,
          'name', b.name,
          'spent_usd', bs2.total_spent_usd
        )
        from public.building_spending bs2
        join public.buildings b on b.id = bs2.building_id
        where bs2.building_id in (
          select building_id from public.building_spending bs3
          where bs3.building_id in (
            select id from public.buildings where org_id = p_org_id
          )
            and bs3.month = date_trunc('month', p_month)::date
        )
        order by bs2.total_spent_usd desc
        limit 1
      ),
      'lowest_spending_building', (
        select json_build_object(
          'building_id', bs2.building_id,
          'name', b.name,
          'spent_usd', bs2.total_spent_usd
        )
        from public.building_spending bs2
        join public.buildings b on b.id = bs2.building_id
        where bs2.building_id in (
          select building_id from public.building_spending bs3
          where bs3.building_id in (
            select id from public.buildings where org_id = p_org_id
          )
            and bs3.month = date_trunc('month', p_month)::date
        )
        order by bs2.total_spent_usd asc
        limit 1
      )
    )
    from public.building_spending bs
    join public.buildings b on b.id = bs.building_id
    where b.org_id = p_org_id
      and bs.month = date_trunc('month', p_month)::date
  );
end; $function$;
