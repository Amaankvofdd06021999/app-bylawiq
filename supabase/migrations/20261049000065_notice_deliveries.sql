-- Resident notice delivery: one persisted delivery per resident per approved notice. Queued, sent, or failed, with attempts and a
-- generic last error. Managers who may adopt bylaws read the status; no one writes a delivery directly.
--
-- Rollback: supabase/rollbacks/20261049000065_notice_deliveries.down.sql.

create table public.notice_deliveries (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  notice_id uuid not null,
  recipient_user_id uuid not null references auth.users(id),
  recipient_email text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  last_error text check (last_error is null or length(last_error) <= 200),
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (notice_id, recipient_user_id),
  foreign key (notice_id, building_id) references public.generated_documents(id, building_id),
  check (status <> 'sent' or sent_at is not null)
);

create index notice_deliveries_building_idx on public.notice_deliveries(building_id);
create index notice_deliveries_notice_idx on public.notice_deliveries(notice_id);

alter table public.notice_deliveries enable row level security;

create policy notice_deliveries_read on public.notice_deliveries for select to authenticated
  using (public.authorize('bylaw.adopt', building_id));
grant select on public.notice_deliveries to authenticated;
revoke insert, update, delete on public.notice_deliveries from authenticated, anon;

-- Queue: one delivery for each active resident of the building. Only an approved notice can be queued.
create function public.queue_notice_delivery(p_notice uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare n public.generated_documents; queued integer;
begin
  select * into n from public.generated_documents where id = p_notice;
  if not found or not public.authorize('bylaw.adopt', n.building_id) then raise exception 'forbidden'; end if;
  if n.status <> 'approved' then raise exception 'notice_not_approved'; end if;
  with new_rows as (
    insert into public.notice_deliveries (building_id, notice_id, recipient_user_id, recipient_email)
    select bm.building_id, n.id, bm.user_id, u.email
    from public.building_members bm
    join auth.users u on u.id = bm.user_id
    where bm.building_id = n.building_id
      and bm.role = 'owner_resident'
      and bm.status = 'active'
      and u.email is not null
    on conflict (notice_id, recipient_user_id) do nothing
    returning 1
  )
  select count(*)::int into queued from new_rows;
  return queued;
end; $$;

-- Claim: the deliveries to attempt now (queued, or failed with attempts left). Claiming counts the attempt.
create function public.claim_notice_deliveries(p_notice uuid, p_limit integer default 50)
returns table(delivery_id uuid, email_address text)
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
  returning d.id, d.recipient_email;
end; $$;

-- Record the outcome of one attempt. The error text is generic and is cut to 200 characters.
create function public.record_notice_delivery_result(p_delivery uuid, p_ok boolean, p_error text) returns void
language plpgsql security definer set search_path='' as $$
declare d public.notice_deliveries;
begin
  select * into d from public.notice_deliveries where id = p_delivery for update;
  if not found or not public.authorize('bylaw.adopt', d.building_id) then raise exception 'forbidden'; end if;
  if p_ok then
    update public.notice_deliveries set status = 'sent', sent_at = now(), last_error = null, updated_at = now() where id = p_delivery;
  else
    update public.notice_deliveries
       set status = 'failed', last_error = left(coalesce(nullif(trim(p_error), ''), 'The email could not be sent.'), 200), updated_at = now()
     where id = p_delivery;
  end if;
end; $$;

revoke all on function public.queue_notice_delivery(uuid) from public, anon;
revoke all on function public.claim_notice_deliveries(uuid, integer) from public, anon;
revoke all on function public.record_notice_delivery_result(uuid, boolean, text) from public, anon;
grant execute on function public.queue_notice_delivery(uuid) to authenticated;
grant execute on function public.claim_notice_deliveries(uuid, integer) to authenticated;
grant execute on function public.record_notice_delivery_result(uuid, boolean, text) to authenticated;
