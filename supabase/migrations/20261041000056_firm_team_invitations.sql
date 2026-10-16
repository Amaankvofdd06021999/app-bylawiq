-- Firm team: invitations and management. Owners invite people by email, the invitee accepts with the link while signed
-- in with that email, and owners can remove members (suspension, so the record stays). Writes go through functions
-- that check the caller is an active owner of the firm; the table is readable by that owner only.
--
-- Rollback: drop function public.accept_firm_invitation(text), public.revoke_firm_invitation(uuid),
--   public.create_firm_invitation(uuid, text, text, text, timestamptz), public.remove_firm_member(uuid, uuid);
--   drop table public.firm_invitations;

create table public.firm_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email) and length(email) between 3 and 320),
  role text not null check (role in ('org_admin', 'portfolio_manager')),
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz
);
create index firm_invitations_org_idx on public.firm_invitations(org_id);

alter table public.firm_invitations enable row level security;
create policy firm_invitations_owner_read on public.firm_invitations for select to authenticated
  using (exists (
    select 1 from public.org_members m
    where m.org_id = firm_invitations.org_id and m.user_id = (select auth.uid())
      and m.role = 'org_owner' and m.status = 'active'
  ));

revoke all on public.firm_invitations from public, anon, authenticated;
grant select on public.firm_invitations to authenticated;

create or replace function private.is_active_firm_owner(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org and m.user_id = (select auth.uid())
      and m.role = 'org_owner' and m.status = 'active'
  );
$$;

create or replace function public.create_firm_invitation(
  p_org uuid,
  p_email text,
  p_role text,
  p_token_hash text,
  p_expires timestamptz
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare v_id uuid;
begin
  if not private.is_active_firm_owner(p_org) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_role not in ('org_admin', 'portfolio_manager') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if p_expires <= now() or p_expires > now() + interval '30 days' then
    raise exception 'invalid_expiry' using errcode = 'P0001';
  end if;
  insert into public.firm_invitations (org_id, email, role, token_hash, created_by, expires_at)
  values (p_org, lower(trim(p_email)), p_role, p_token_hash, (select auth.uid()), p_expires)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.revoke_firm_invitation(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_org uuid;
begin
  select org_id into v_org from public.firm_invitations where id = p_id;
  if v_org is null or not private.is_active_firm_owner(v_org) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.firm_invitations set revoked_at = now()
  where id = p_id and accepted_at is null and revoked_at is null;
end;
$$;

create or replace function public.accept_firm_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_invite public.firm_invitations;
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  select * into v_invite from public.firm_invitations where token_hash = p_token_hash for update;
  if not found or v_invite.accepted_at is not null or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'invitation_unavailable' using errcode = 'P0001';
  end if;
  if v_email = '' or v_email <> v_invite.email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;
  insert into public.org_members (org_id, user_id, role, status)
  values (v_invite.org_id, (select auth.uid()), v_invite.role::public.app_role, 'active')
  on conflict (org_id, user_id) do update set role = excluded.role, status = 'active';
  update public.firm_invitations set accepted_at = now(), accepted_by = (select auth.uid()) where id = v_invite.id;
  return v_invite.org_id;
end;
$$;

create or replace function public.remove_firm_member(p_org uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not private.is_active_firm_owner(p_org) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'cannot_remove_self' using errcode = 'P0001';
  end if;
  update public.org_members set status = 'suspended'
  where org_id = p_org and user_id = p_user and role <> 'org_owner';
end;
$$;

revoke all on function private.is_active_firm_owner(uuid) from public, anon;
revoke all on function public.create_firm_invitation(uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.revoke_firm_invitation(uuid) from public, anon;
revoke all on function public.accept_firm_invitation(text) from public, anon;
revoke all on function public.remove_firm_member(uuid, uuid) from public, anon;
grant execute on function public.create_firm_invitation(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.revoke_firm_invitation(uuid) to authenticated;
grant execute on function public.accept_firm_invitation(text) to authenticated;
grant execute on function public.remove_firm_member(uuid, uuid) to authenticated;
