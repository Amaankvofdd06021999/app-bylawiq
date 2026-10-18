-- Notice delivery privacy: raw resident email addresses are removed from the delivery record. The record keeps a masked form
-- only. The claim function returns delivery ids, not addresses. Managers read masked addresses and status through explicit
-- column grants. Sending stays disabled until the sender design is approved (docs/NOTICE-DELIVERY-DECISION.md).
--
-- Rollback: supabase/rollbacks/20261050000066_notice_delivery_privacy.down.sql. Raw addresses cannot be restored from masked
-- values; the rollback restores the column shape only.

alter table public.notice_deliveries add column masked_address text;

update public.notice_deliveries d
   set masked_address = left(d.recipient_email, 1) || '***' || substring(d.recipient_email from position('@' in d.recipient_email));

alter table public.notice_deliveries alter column masked_address set not null;
alter table public.notice_deliveries add constraint notice_deliveries_masked_shape
  check (masked_address like '_***@%');
alter table public.notice_deliveries drop column recipient_email;

-- Queue: the masked address is computed from the account's address, which is not stored.
create or replace function public.queue_notice_delivery(p_notice uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare n public.generated_documents; queued integer;
begin
  select * into n from public.generated_documents where id = p_notice;
  if not found or not public.authorize('bylaw.adopt', n.building_id) then raise exception 'forbidden'; end if;
  if n.status <> 'approved' then raise exception 'notice_not_approved'; end if;
  with new_rows as (
    insert into public.notice_deliveries (building_id, notice_id, recipient_user_id, masked_address)
    select bm.building_id, n.id, bm.user_id,
           left(u.email, 1) || '***' || substring(u.email from position('@' in u.email))
    from public.building_members bm
    join auth.users u on u.id = bm.user_id
    where bm.building_id = n.building_id
      and bm.role = 'owner_resident'
      and bm.status = 'active'
      and u.email is not null
      and position('@' in u.email) > 1
    on conflict (notice_id, recipient_user_id) do nothing
    returning 1
  )
  select count(*)::int into queued from new_rows;
  return queued;
end; $$;

-- Claim: returns delivery ids only. No address leaves the database through this function.
drop function public.claim_notice_deliveries(uuid, integer);
create function public.claim_notice_deliveries(p_notice uuid, p_limit integer default 50)
returns table(delivery_id uuid)
language plpgsql security definer set search_path='' as $$
declare n public.generated_documents;
begin
  select * into n from public.generated_documents where id = p_notice;
  if not found or not public.authorize('bylaw.adopt', n.building_id) then raise exception 'forbidden'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then raise exception 'invalid_batch'; end if;
  return query
  with picked as (
    select d.id from public.notice_deliveries d
    where d.notice_id = n.id
      and ((d.status = 'queued') or (d.status = 'failed' and d.attempts < 3))
    order by d.queued_at
    limit p_limit
    for update skip locked
  )
  update public.notice_deliveries d
     set attempts = d.attempts + 1, updated_at = now()
    from picked
   where d.id = picked.id
  returning d.id;
end; $$;

-- Column privileges: managers read the record without the raw address (which no longer exists).
revoke all on public.notice_deliveries from authenticated, anon;
grant select (id, building_id, notice_id, recipient_user_id, masked_address, status, attempts, last_error, queued_at, sent_at, updated_at)
  on public.notice_deliveries to authenticated;

revoke all on function public.claim_notice_deliveries(uuid, integer) from public, anon;
grant execute on function public.claim_notice_deliveries(uuid, integer) to authenticated;
