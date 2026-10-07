-- supabase/migrations/20261011_cost_controls.sql
-- Phase 5: Cost controls and monitoring for resident credits and billing
--
-- Enables:
-- 1. Per-org monthly credit budgets
-- 2. Spending alerts and notifications
-- 3. Cost-per-building reporting
-- 4. Rate limiting per resident
-- 5. Usage analytics and trends
--
-- Rollback: drop table public.cost_overrides; drop table public.spending_alerts; drop table public.org_budgets; drop table public.usage_analytics;

create table public.org_budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  -- Monthly budget
  month date not null, -- Year-Month: 2026-10-01, 2026-11-01, etc.
  monthly_limit_usd numeric not null,
  monthly_limit_credits numeric generated always as (monthly_limit_usd * 100) stored, -- Convert USD to credits

  -- Tracking
  total_spent_usd numeric not null default 0,
  total_spent_credits numeric not null default 0,
  alert_threshold_pct integer not null default 80, -- Alert at 80% spent

  -- Notifications
  alert_sent_at timestamptz, -- When 80% alert was sent
  limit_reached_at timestamptz, -- When budget exceeded

  -- Metadata
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(org_id, month)
);

create index org_budgets_org_idx on public.org_budgets(org_id, month desc);
create index org_budgets_month_idx on public.org_budgets(month desc);

-- Spending per building (for analytics)
create table public.building_spending (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,

  -- Monthly summary
  month date not null,
  residents_active integer not null default 0,
  questions_asked integer not null default 0,
  total_spent_usd numeric not null default 0,
  total_spent_credits numeric not null default 0,

  -- Breakdown by action
  questions_cost_usd numeric not null default 0,
  drafts_cost_usd numeric not null default 0,

  -- Metrics
  avg_question_cost_usd numeric,
  max_spend_resident_usd numeric, -- Highest spender in this building

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(building_id, month)
);

create index building_spending_org_idx on public.building_spending(org_id, month desc);
create index building_spending_building_idx on public.building_spending(building_id, month desc);

-- Rate limiting per resident (daily limits)
create table public.resident_rate_limits (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Limits
  daily_questions_limit integer not null default 10, -- Max questions per day
  daily_questions_asked integer not null default 0,

  -- Reset
  day date not null default current_date,

  -- Tracking
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(building_id, user_id, day)
);

create index resident_rate_limits_day_idx on public.resident_rate_limits(day desc);
create index resident_rate_limits_building_idx on public.resident_rate_limits(building_id, day desc);

-- Spending alerts and notifications
create table public.spending_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  -- Alert details
  kind text not null check(kind in ('threshold_reached', 'budget_exceeded', 'unusual_activity')),
  title text not null,
  message text not null,

  -- Context
  month date,
  spending_pct integer, -- 80, 100, 150 (% of budget)
  current_spend_usd numeric,
  budget_limit_usd numeric,

  -- Notification status
  sent_at timestamptz,
  sent_to_email text[], -- Array of emails notified
  read_at timestamptz,
  dismissed_at timestamptz,

  -- Metadata
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),

  -- Trigger escalation
  escalated boolean default false,
  escalated_to uuid references auth.users(id) -- Finance/billing person
);

create index spending_alerts_org_idx on public.spending_alerts(org_id, created_at desc);
create index spending_alerts_kind_idx on public.spending_alerts(kind, sent_at desc);
create index spending_alerts_unread_idx on public.spending_alerts(org_id)
  where read_at is null and dismissed_at is null;

-- Usage analytics (for trend analysis)
create table public.usage_analytics (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,

  -- Time period
  period date not null, -- Date for daily; First day of month for monthly
  period_type text not null check(period_type in ('daily', 'weekly', 'monthly')),

  -- Usage metrics
  active_residents integer not null default 0,
  total_questions integer not null default 0,
  total_draft_actions integer not null default 0,
  avg_daily_questions numeric,

  -- Quality metrics
  avg_response_time_ms integer,
  error_rate_pct numeric,
  no_grounding_rate_pct numeric, -- Questions with no matching documents

  -- Cost metrics
  total_cost_usd numeric not null default 0,
  cost_per_resident numeric,
  cost_per_question numeric,

  -- Trend indicators
  growth_pct numeric, -- Week-over-week or month-over-month growth
  churn_residents integer, -- Residents who stopped using

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(building_id, period, period_type)
);

create index usage_analytics_org_idx on public.usage_analytics(org_id, period desc);
create index usage_analytics_building_idx on public.usage_analytics(building_id, period desc);
create index usage_analytics_period_idx on public.usage_analytics(period desc, period_type);

-- RLS Policies
alter table public.org_budgets enable row level security;
alter table public.building_spending enable row level security;
alter table public.resident_rate_limits enable row level security;
alter table public.spending_alerts enable row level security;
alter table public.usage_analytics enable row level security;

-- Org owners/admins can see budgets for their org
create policy org_budgets_read on public.org_budgets
  for select to authenticated
  using(
    org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('org_owner', 'org_admin') and status = 'active'
    )
  );

create policy org_budgets_write on public.org_budgets
  for insert to authenticated
  with check(
    org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('org_owner', 'org_admin') and status = 'active'
    )
  );

create policy org_budgets_update on public.org_budgets
  for update to authenticated
  using(
    org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('org_owner', 'org_admin') and status = 'active'
    )
  );

-- Building spending visible to building managers and org staff
create policy building_spending_read on public.building_spending
  for select to authenticated
  using(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid() and status = 'active'
    )
    or org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- Residents can see their own rate limits
create policy resident_rate_limits_read on public.resident_rate_limits
  for select to authenticated
  using(
    user_id = auth.uid()
    or building_id in (
      select building_id from public.building_members
      where user_id = auth.uid() and role in ('building_manager', 'council_president', 'org_owner', 'org_admin') and status = 'active'
    )
  );

-- Spending alerts visible to org owners/admins
create policy spending_alerts_read on public.spending_alerts
  for select to authenticated
  using(
    org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('org_owner', 'org_admin') and status = 'active'
    )
  );

-- Usage analytics visible to org staff and building managers
create policy usage_analytics_read on public.usage_analytics
  for select to authenticated
  using(
    building_id in (
      select building_id from public.building_members
      where user_id = auth.uid() and status = 'active'
    )
    or org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- FUNCTIONS FOR COST MANAGEMENT

-- Increment spending in org budget
create or replace function public.increment_org_spending(
  p_org_id uuid,
  p_cost_usd numeric
)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_budget_id uuid;
  v_new_total numeric;
  v_pct_spent numeric;
  v_threshold_pct integer;
begin
  -- Get current month's budget
  select id, alert_threshold_pct into v_budget_id, v_threshold_pct
  from public.org_budgets
  where org_id = p_org_id and month = date_trunc('month', now())::date
  limit 1;

  if v_budget_id is null then
    -- No budget set; just log the spending
    return;
  end if;

  -- Update spending
  update public.org_budgets
  set
    total_spent_usd = total_spent_usd + p_cost_usd,
    total_spent_credits = total_spent_credits + (p_cost_usd * 100),
    updated_at = now()
  where id = v_budget_id
  returning total_spent_usd into v_new_total;

  -- Calculate percentage spent
  v_pct_spent := (v_new_total / monthly_limit_usd) * 100
  from public.org_budgets where id = v_budget_id;

  -- Check if alert threshold reached
  if v_pct_spent >= v_threshold_pct and alert_sent_at is null then
    -- Send alert
    insert into public.spending_alerts(org_id, kind, title, message, month, spending_pct, current_spend_usd, budget_limit_usd)
    select
      p_org_id,
      'threshold_reached',
      'Budget alert: ' || v_threshold_pct || '% spent',
      'Your organization has spent ' || v_threshold_pct || '% of this month''s budget ($' || v_new_total || ')',
      month,
      v_threshold_pct,
      v_new_total,
      monthly_limit_usd
    from public.org_budgets where id = v_budget_id;

    -- Mark alert as sent
    update public.org_budgets set alert_sent_at = now() where id = v_budget_id;
  end if;

  -- Check if budget exceeded
  if v_pct_spent >= 100 and limit_reached_at is null then
    insert into public.spending_alerts(org_id, kind, title, message, month, spending_pct, current_spend_usd, budget_limit_usd, escalated)
    select
      p_org_id,
      'budget_exceeded',
      'Budget exceeded',
      'Your organization has exceeded this month''s budget. New spending may be rate-limited.',
      month,
      v_pct_spent,
      v_new_total,
      monthly_limit_usd,
      true
    from public.org_budgets where id = v_budget_id;

    update public.org_budgets set limit_reached_at = now() where id = v_budget_id;
  end if;
end; $$;

-- Check if resident can ask (rate limit)
create or replace function public.can_resident_ask(
  p_user_id uuid,
  p_building_id uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_limit_record public.resident_rate_limits%rowtype;
  v_daily_limit integer;
  v_questions_remaining integer;
begin
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
end; $$;

-- Increment daily question count
create or replace function public.increment_daily_questions(
  p_user_id uuid,
  p_building_id uuid
)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.resident_rate_limits(building_id, user_id, day, daily_questions_asked)
  values(p_building_id, p_user_id, current_date, 1)
  on conflict(building_id, user_id, day) do update
  set
    daily_questions_asked = resident_rate_limits.daily_questions_asked + 1,
    updated_at = now();
end; $$;

grant execute on function public.increment_org_spending to authenticated;
grant execute on function public.can_resident_ask to authenticated;
grant execute on function public.increment_daily_questions to authenticated;

-- Audit triggers
create trigger audit_org_budgets
after insert or update on public.org_budgets
for each row
execute function public.audit_change();

create trigger audit_building_spending
after insert or update on public.building_spending
for each row
execute function public.audit_change();

create trigger audit_spending_alerts
after insert or update on public.spending_alerts
for each row
execute function public.audit_change();
