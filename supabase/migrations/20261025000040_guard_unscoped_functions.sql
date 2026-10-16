-- Functions that read or change building or organization data must check the caller, not trust the arguments.
-- Before this, several SECURITY DEFINER functions took a building_id, org_id or user_id and returned or changed that
-- row without checking the caller, so a signed-in user of one building could read another building's records.
-- Staff checks use public.authorize('chat.use', building) (owner_resident does not have chat.use); org checks use
-- org_members; the per-user quota functions only act on the caller's own row.
-- increment_org_spending is revoked: nothing calls it and its body is not valid PL/pgSQL (the spend alert SELECT is
-- malformed), so it cannot run as written. It can be rewritten and granted again when the cost-control work resumes.
-- Rollback: recreate each function from its previous definition (supabase/migrations/20261011000022_cost_controls.sql,
-- 20261012000023_staff_documents.sql, 20261013000025_financial_analytics.sql, 20260914092416 and the search_* migrations),
-- and re-grant execute to authenticated for increment_org_spending.

CREATE OR REPLACE FUNCTION public.search_maintenance_logs(p_building_id uuid, p_query text, p_limit integer DEFAULT 10)
 RETURNS TABLE(log_id uuid, issue_type text, description text, severity text, status text, reported_at timestamp with time zone, resolved_at timestamp with time zone, actual_cost numeric, relevance_score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query_tsvector tsvector;
begin
  if not public.authorize('chat.use', p_building_id) then raise insufficient_privilege using message = 'forbidden'; end if;
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
end; $function$;

CREATE OR REPLACE FUNCTION public.search_vendor_contracts(p_building_id uuid, p_query text, p_limit integer DEFAULT 10)
 RETURNS TABLE(contract_id uuid, vendor_name text, service_type text, contract_start_date date, contract_end_date date, monthly_cost numeric, annual_cost numeric, status text, relevance_score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query_tsvector tsvector;
begin
  if not public.authorize('chat.use', p_building_id) then raise insufficient_privilege using message = 'forbidden'; end if;
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
end; $function$;

CREATE OR REPLACE FUNCTION public.search_insurance_policies(p_building_id uuid, p_query text, p_limit integer DEFAULT 10)
 RETURNS TABLE(policy_id uuid, policy_type text, provider_name text, policy_number text, coverage_amount numeric, deductible numeric, policy_start_date date, policy_end_date date, status text, relevance_score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_query_tsvector tsvector;
begin
  if not public.authorize('chat.use', p_building_id) then raise insufficient_privilege using message = 'forbidden'; end if;
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
  v_month := (p_month || '-01')::date;

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

CREATE OR REPLACE FUNCTION public.get_spending_trends(p_building_id uuid, p_months_back integer DEFAULT 6)
 RETURNS TABLE(month date, total_spent_usd numeric, residents_active integer, questions_asked integer, avg_question_cost_usd numeric, growth_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.authorize('chat.use', p_building_id) then raise insufficient_privilege using message = 'forbidden'; end if;
  return query
  with spending_history as (
    select
      bs.month,
      bs.total_spent_usd,
      bs.residents_active,
      bs.questions_asked,
      bs.avg_question_cost_usd,
      lag(bs.total_spent_usd) over (order by bs.month) as prev_spent,
      row_number() over (order by bs.month) as month_seq
    from public.building_spending bs
    where bs.building_id = p_building_id
      and bs.month >= (current_date - (p_months_back || ' months')::interval)::date
    order by bs.month
  )
  select
    sh.month,
    sh.total_spent_usd,
    sh.residents_active,
    sh.questions_asked,
    sh.avg_question_cost_usd,
    case
      when sh.prev_spent > 0 then
        ((sh.total_spent_usd - sh.prev_spent) / sh.prev_spent * 100)::numeric
      else null
    end as growth_pct
  from spending_history sh
  order by sh.month desc;
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
  v_month := (p_month || '-01')::date;

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
      'month', (p_month || '-01')::date,
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
            and bs3.month = (p_month || '-01')::date
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
            and bs3.month = (p_month || '-01')::date
        )
        order by bs2.total_spent_usd asc
        limit 1
      )
    )
    from public.building_spending bs
    join public.buildings b on b.id = bs.building_id
    where b.org_id = p_org_id
      and bs.month = (p_month || '-01')::date
  );
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
  v_month := (p_month || '-01')::date;

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

CREATE OR REPLACE FUNCTION public.can_resident_ask(p_user_id uuid, p_building_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_limit_record public.resident_rate_limits%rowtype;
  v_daily_limit integer;
  v_questions_remaining integer;
begin
  if p_user_id is distinct from auth.uid() then raise insufficient_privilege using message = 'forbidden'; end if;
  -- Get rate limit for today
  select * into v_limit_record
  from public.resident_rate_limits
  where user_id = p_user_id
    and building_id = p_building_id
    and day = current_date
  limit 1;

  -- If no record exists, create one
  if v_limit_record.id is null then
    insert into public.resident_rate_limits(building_id, user_id, day)
    values(p_building_id, p_user_id, current_date)
    returning * into v_limit_record;
  end if;

  -- Check if limit reached
  v_questions_remaining := v_limit_record.daily_questions_limit - v_limit_record.daily_questions_asked;

  return jsonb_build_object(
    'can_ask', v_questions_remaining > 0,
    'questions_remaining', v_questions_remaining,
    'daily_limit', v_limit_record.daily_questions_limit,
    'questions_asked_today', v_limit_record.daily_questions_asked
  );
end; $function$;

CREATE OR REPLACE FUNCTION public.increment_daily_questions(p_user_id uuid, p_building_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_user_id is distinct from auth.uid() then raise insufficient_privilege using message = 'forbidden'; end if;
  insert into public.resident_rate_limits(building_id, user_id, day, daily_questions_asked)
  values(p_building_id, p_user_id, current_date, 1)
  on conflict(building_id, user_id, day) do update
  set
    daily_questions_asked = resident_rate_limits.daily_questions_asked + 1,
    updated_at = now();
end; $function$;

CREATE OR REPLACE FUNCTION public.get_expiring_contracts(p_building_id uuid, p_days_ahead integer DEFAULT 30)
 RETURNS TABLE(vendor_name text, contract_end_date date, days_until_expiry integer, service_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select
    vendor_name,
    contract_end_date,
    (contract_end_date - current_date)::int,
    service_type
  from public.vendor_contracts
  where building_id = p_building_id
    and public.authorize('chat.use', p_building_id)
    and status != 'expired'
    and contract_end_date <= (current_date + (p_days_ahead || ' days')::interval)
  order by contract_end_date;
$function$;

CREATE OR REPLACE FUNCTION public.get_expiring_policies(p_building_id uuid, p_days_ahead integer DEFAULT 60)
 RETURNS TABLE(provider_name text, policy_type text, policy_end_date date, days_until_expiry integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select
    provider_name,
    policy_type,
    policy_end_date,
    (policy_end_date - current_date)::int
  from public.insurance_policies
  where building_id = p_building_id
    and public.authorize('chat.use', p_building_id)
    and status != 'expired'
    and policy_end_date <= (current_date + (p_days_ahead || ' days')::interval)
  order by policy_end_date;
$function$;

revoke execute on function public.increment_org_spending(uuid, numeric) from public, anon, authenticated;
