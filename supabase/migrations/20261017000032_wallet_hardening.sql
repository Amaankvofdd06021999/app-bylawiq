-- Resident wallets: balances change only through deduct_wallet_credits (caller's own wallet, positive whole
-- amounts) and add_wallet_credits (service role, after a verified Stripe payment, idempotent per payment).
-- Rollback: recreate the wallet_update and transactions_insert policies, grant insert/update back to authenticated,
-- and re-grant add_wallet_credits to authenticated. Do not roll back in production: it reopens free credits.

drop policy if exists wallet_update on public.resident_wallets;
drop policy if exists transactions_insert on public.wallet_transactions;

revoke all on public.resident_wallets, public.wallet_transactions from anon, authenticated;
grant select on public.resident_wallets, public.wallet_transactions to authenticated;

create or replace function public.deduct_wallet_credits(
  p_user_id uuid,
  p_building_id uuid,
  p_amount numeric,
  p_reason text,
  p_metadata jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_wallet_id uuid;
  v_balance numeric;
  v_new_balance numeric;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select id, credits into v_wallet_id, v_balance
  from public.resident_wallets
  where user_id = p_user_id and building_id = p_building_id
  for update;

  if v_wallet_id is null then
    raise exception 'wallet_not_found' using errcode = 'P0002';
  end if;
  if v_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'insufficient_credits', 'credits', v_balance);
  end if;

  update public.resident_wallets
  set credits = credits - p_amount,
      lifetime_spent = lifetime_spent + p_amount,
      updated_at = now()
  where id = v_wallet_id
  returning credits into v_new_balance;

  insert into public.wallet_transactions(wallet_id, kind, amount, reason, metadata, created_by)
  values (v_wallet_id, 'spend', p_amount, p_reason, p_metadata, auth.uid());

  return jsonb_build_object('success', true, 'new_balance', v_new_balance, 'spent', p_amount);
end; $$;

create or replace function public.add_wallet_credits(
  p_user_id uuid,
  p_building_id uuid,
  p_amount numeric,
  p_stripe_tx_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_wallet_id uuid;
  v_new_balance numeric;
begin
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select id into v_wallet_id
  from public.resident_wallets
  where user_id = p_user_id and building_id = p_building_id
  for update;

  if v_wallet_id is null then
    raise exception 'wallet_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.wallet_transactions
    where wallet_id = v_wallet_id and kind = 'purchase' and metadata->>'stripe_tx_id' = p_stripe_tx_id
  ) then
    select credits into v_new_balance from public.resident_wallets where id = v_wallet_id;
    return jsonb_build_object('success', true, 'already_applied', true, 'new_balance', v_new_balance, 'purchased', 0);
  end if;

  update public.resident_wallets
  set credits = credits + p_amount,
      lifetime_purchased = lifetime_purchased + p_amount,
      updated_at = now()
  where id = v_wallet_id
  returning credits into v_new_balance;

  insert into public.wallet_transactions(wallet_id, kind, amount, reason, metadata)
  values (v_wallet_id, 'purchase', p_amount, 'stripe_payment', jsonb_build_object('stripe_tx_id', p_stripe_tx_id));

  return jsonb_build_object('success', true, 'new_balance', v_new_balance, 'purchased', p_amount);
end; $$;

revoke execute on function public.add_wallet_credits(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.add_wallet_credits(uuid, uuid, numeric, text) to service_role;
grant execute on function public.deduct_wallet_credits(uuid, uuid, numeric, text, jsonb) to authenticated;

create index if not exists wallet_transactions_stripe_idx
  on public.wallet_transactions((metadata->>'stripe_tx_id'))
  where kind = 'purchase';
