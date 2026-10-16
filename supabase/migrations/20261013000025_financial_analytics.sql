-- supabase/migrations/20261013_financial_analytics.sql
-- Phase 5D: Financial analytics functions for Strata Manager and Firm Owner queries
-- Enables questions like "Which building is most profitable?" "Compare costs across buildings"

-- Get spending summary for a building (for building manager queries)
create or replace function public.get_building_spending_summary(
  p_building_id uuid,
  p_month date default current_date - interval '1 month'
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_result jsonb;
  v_month date;
begin
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
end; $$;

-- Get spending comparison across multiple buildings (for strata manager)
create or replace function public.compare_building_spending(
  p_building_ids uuid[],
  p_month date default current_date - interval '1 month'
)
returns table(
  building_id uuid,
  building_name text,
  residents_active integer,
  questions_asked integer,
  total_spent_usd numeric,
  avg_spend_per_resident numeric,
  ranking integer
) language plpgsql security definer set search_path='' as $$
declare
  v_month date;
begin
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
end; $$;

-- Get spending trends for a building (month over month)
create or replace function public.get_spending_trends(
  p_building_id uuid,
  p_months_back int default 6
)
returns table(
  month date,
  total_spent_usd numeric,
  residents_active integer,
  questions_asked integer,
  avg_question_cost_usd numeric,
  growth_pct numeric
) language plpgsql security definer set search_path='' as $$
begin
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
end; $$;

-- Get org-wide spending summary (for firm owner)
create or replace function public.get_org_spending_summary(
  p_org_id uuid,
  p_month date default current_date - interval '1 month'
)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
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
end; $$;

-- Get org budget status (for firm owner oversight)
create or replace function public.get_org_budget_status(
  p_org_id uuid,
  p_month date default current_date - (extract('day' from current_date) - 1)::int * interval '1 day'
)
returns table(
  org_id uuid,
  month date,
  monthly_limit_usd numeric,
  total_spent_usd numeric,
  pct_spent numeric,
  remaining_budget numeric,
  status text,
  alert_level text
) language plpgsql security definer set search_path='' as $$
declare
  v_month date;
begin
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
end; $$;

grant execute on function public.get_building_spending_summary to authenticated;
grant execute on function public.compare_building_spending to authenticated;
grant execute on function public.get_spending_trends to authenticated;
grant execute on function public.get_org_spending_summary to authenticated;
grant execute on function public.get_org_budget_status to authenticated;
