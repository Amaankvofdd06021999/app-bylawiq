-- supabase/migrations/20261012_staff_retrieval.sql
-- Retrieval functions for staff-only documents (maintenance logs, contracts, insurance)
-- These allow building managers to search across staff documents in chatbot context

-- Search maintenance logs for a building
create or replace function public.search_maintenance_logs(
  p_building_id uuid,
  p_query text,
  p_limit int default 10
)
returns table(
  log_id uuid,
  issue_type text,
  description text,
  severity text,
  status text,
  reported_at timestamptz,
  resolved_at timestamptz,
  actual_cost numeric,
  relevance_score float
) language plpgsql security definer set search_path='' as $$
declare
  v_query_tsvector tsvector;
begin
  v_query_tsvector := to_tsvector('english', p_query);

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
end; $$;

-- Search vendor contracts
create or replace function public.search_vendor_contracts(
  p_building_id uuid,
  p_query text,
  p_limit int default 10
)
returns table(
  contract_id uuid,
  vendor_name text,
  service_type text,
  contract_start_date date,
  contract_end_date date,
  monthly_cost numeric,
  annual_cost numeric,
  status text,
  relevance_score float
) language plpgsql security definer set search_path='' as $$
declare
  v_query_tsvector tsvector;
begin
  v_query_tsvector := to_tsvector('english', p_query);

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
end; $$;

-- Search insurance policies
create or replace function public.search_insurance_policies(
  p_building_id uuid,
  p_query text,
  p_limit int default 10
)
returns table(
  policy_id uuid,
  policy_type text,
  provider_name text,
  policy_number text,
  coverage_amount numeric,
  deductible numeric,
  policy_start_date date,
  policy_end_date date,
  status text,
  relevance_score float
) language plpgsql security definer set search_path='' as $$
declare
  v_query_tsvector tsvector;
begin
  v_query_tsvector := to_tsvector('english', p_query);

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
end; $$;

grant execute on function public.search_maintenance_logs to authenticated;
grant execute on function public.search_vendor_contracts to authenticated;
grant execute on function public.search_insurance_policies to authenticated;
