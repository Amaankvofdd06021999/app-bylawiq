-- supabase/migrations/20261009_resident_wallets.sql
-- Phase 3: Resident wallet system for paid chat features
--
-- Enables residents to:
-- 1. Purchase credits via Stripe
-- 2. Spend credits on asking questions, drafting documents
-- 3. Track spending and lifetime value
-- 4. View transaction history
--
-- Rollback: drop table public.wallet_transactions; drop table public.resident_wallets;

create table public.resident_wallets (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Balance in credits (1 credit = $0.01)
  credits numeric not null default 0 check(credits >= 0),

  -- Lifetime metrics
  lifetime_purchased numeric not null default 0,
  lifetime_spent numeric not null default 0,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One wallet per user per building
  unique(building_id, user_id)
);

create index resident_wallets_user_idx on public.resident_wallets(user_id, building_id);
create index resident_wallets_building_idx on public.resident_wallets(building_id, created_at desc);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.resident_wallets(id) on delete cascade,

  kind text not null check(kind in ('purchase', 'spend', 'refund', 'adjustment')),
  amount numeric not null check(amount > 0),
  reason text, -- 'draft_letter', 'draft_notice', 'ask_question', 'stripe_payment', etc.

  metadata jsonb not null default '{}', -- { stripe_tx_id, question_id, document_id, etc. }

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index wallet_transactions_wallet_idx on public.wallet_transactions(wallet_id, created_at desc);
create index wallet_transactions_kind_idx on public.wallet_transactions(kind, created_at desc);
create index wallet_transactions_reason_idx on public.wallet_transactions(reason, created_at desc);

-- Trigger to auto-create wallet when resident is first invited
create or replace function public.auto_create_resident_wallet()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.role = 'owner_resident'::public.app_role and new.status = 'active' then
    insert into public.resident_wallets(building_id, user_id)
    values(new.building_id, new.user_id)
    on conflict(building_id, user_id) do update
    set updated_at = now();
  end if;
  return new;
end; $$;

create trigger resident_wallet_auto_create
after insert or update on public.building_members
for each row
execute function public.auto_create_resident_wallet();

-- Function to deduct credits (called from chat route after message completes)
create or replace function public.deduct_wallet_credits(
  p_user_id uuid,
  p_building_id uuid,
  p_amount numeric,
  p_reason text,
  p_metadata jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_wallet_id uuid;
  v_new_balance numeric;
begin
  -- Get wallet (user must be authenticated and requesting their own wallet)
  if p_user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;

  select id into v_wallet_id
  from public.resident_wallets
  where user_id = p_user_id and building_id = p_building_id
  for update;

  if v_wallet_id is null then
    raise exception 'wallet_not_found';
  end if;

  -- Deduct credits
  update public.resident_wallets
  set
    credits = credits - p_amount,
    lifetime_spent = lifetime_spent + p_amount,
    updated_at = now()
  where id = v_wallet_id
  returning credits into v_new_balance;

  -- Log transaction
  insert into public.wallet_transactions(wallet_id, kind, amount, reason, metadata, created_by)
  values(v_wallet_id, 'spend', p_amount, p_reason, p_metadata, auth.uid());

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'spent', p_amount
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'error', sqlerrm
    );
end; $$;

-- Function to add credits (called from Stripe webhook)
create or replace function public.add_wallet_credits(
  p_user_id uuid,
  p_building_id uuid,
  p_amount numeric,
  p_stripe_tx_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_wallet_id uuid;
  v_new_balance numeric;
begin
  select id into v_wallet_id
  from public.resident_wallets
  where user_id = p_user_id and building_id = p_building_id
  for update;

  if v_wallet_id is null then
    raise exception 'wallet_not_found';
  end if;

  -- Add credits
  update public.resident_wallets
  set
    credits = credits + p_amount,
    lifetime_purchased = lifetime_purchased + p_amount,
    updated_at = now()
  where id = v_wallet_id
  returning credits into v_new_balance;

  -- Log transaction
  insert into public.wallet_transactions(wallet_id, kind, amount, reason, metadata)
  values(
    v_wallet_id,
    'purchase',
    p_amount,
    'stripe_payment',
    jsonb_build_object('stripe_tx_id', p_stripe_tx_id)
  );

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'purchased', p_amount
  );
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'error', sqlerrm
    );
end; $$;

-- RLS Policies
alter table public.resident_wallets enable row level security;
alter table public.wallet_transactions enable row level security;

create policy wallet_read on public.resident_wallets
  for select to authenticated
  using(
    -- Residents can see their own wallet
    user_id = auth.uid()
    -- Building managers/staff can see wallets on their building
    or public.authorize('member.read', building_id)
  );

create policy wallet_update on public.resident_wallets
  for update to authenticated
  using(user_id = auth.uid())
  with check(user_id = auth.uid());

create policy transactions_read on public.wallet_transactions
  for select to authenticated
  using(
    -- Users can see their own transactions
    exists(
      select 1 from public.resident_wallets w
      where w.id = wallet_id and w.user_id = auth.uid()
    )
    -- Building staff can audit resident transactions
    or exists(
      select 1 from public.resident_wallets w
      where w.id = wallet_id
      and public.authorize('member.read', w.building_id)
    )
  );

create policy transactions_insert on public.wallet_transactions
  for insert to authenticated
  with check(
    exists(
      select 1 from public.resident_wallets w
      where w.id = wallet_id and w.user_id = auth.uid()
    )
  );

-- Grant functions to authenticated users
grant execute on function public.deduct_wallet_credits to authenticated;
grant execute on function public.add_wallet_credits to authenticated;

-- Audit trigger
create trigger audit_wallet_transactions
after insert on public.wallet_transactions
for each row
execute function public.audit_change();
