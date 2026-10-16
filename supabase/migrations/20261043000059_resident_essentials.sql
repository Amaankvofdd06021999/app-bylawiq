-- Resident essentials: a resident invitation records the unit number; the membership keeps it unverified until a building
-- manager confirms it; residents can read the building's in-force bylaws (the alerts on their home).
--
-- Rollback: drop function public.verify_resident_unit(uuid, uuid, text) and public.create_resident_invitation(uuid, text,
-- text, text, timestamptz); restore accept_invitation from 20261032000047_retire_account_type_authorization.sql; drop the
-- policies resident_in_force_read and resident_in_force_nodes_read; drop columns invitations.unit_number,
-- building_members.unit_verified_at and building_members.unit_verified_by.

alter table public.invitations add column if not exists unit_number text
  check (unit_number is null or length(unit_number) between 1 and 20);

-- joined_at: when the person joined. Existing rows get the migration time, not their real join date.
alter table public.building_members
  add column if not exists unit_verified_at timestamptz,
  add column if not exists unit_verified_by uuid references auth.users(id),
  add column if not exists joined_at timestamptz not null default now();

-- 1. A resident invitation carries the unit it is for. Same rules as any invitation (create_invitation checks them).
create or replace function public.create_resident_invitation(
  p_building uuid, p_email text, p_unit text, p_hash text, p_expires timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid; u text := trim(coalesce(p_unit, ''));
begin
  if length(u) < 1 or length(u) > 20 then raise exception 'invalid_input' using errcode = 'P0001'; end if;
  i := public.create_invitation(p_building, p_email, 'owner_resident'::public.app_role, p_hash, p_expires);
  update public.invitations set unit_number = u where id = i;
  return i;
end $$;

revoke all on function public.create_resident_invitation(uuid, text, text, text, timestamptz) from public, anon;
grant execute on function public.create_resident_invitation(uuid, text, text, text, timestamptz) to authenticated;

-- 2. Accepting an invitation records the unit, unverified. The rest is unchanged from 20261032000047.
create or replace function public.accept_invitation(p_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; em text;
begin
  select email into em from auth.users where id=auth.uid() and email_confirmed_at is not null;
  select * into i from public.invitations where token_hash=p_hash and email=lower(em) and expires_at>now() and accepted_at is null and revoked_at is null for update;
  if not found then raise exception 'invalid_invitation'; end if;
  update public.profiles set consent_at=now() where id=auth.uid();
  insert into public.building_members(building_id,user_id,role,expires_at,unit_number,unit_verified_at,unit_verified_by)
  values(i.building_id,auth.uid(),i.role,i.membership_expires_at,case when i.role='owner_resident' then i.unit_number end,null,null)
  on conflict(building_id,user_id) do update set role=excluded.role,status='active',expires_at=excluded.expires_at,via_link_id=null,
    unit_number=excluded.unit_number,unit_verified_at=null,unit_verified_by=null
  where public.building_members.status<>'active' or (public.building_members.expires_at is not null and public.building_members.expires_at<=now());
  -- No row written means an active membership already exists.
  if not found then raise exception 'already_member'; end if;
  update public.invitations set accepted_at=now() where id=i.id;
  return i.building_id;
end $$;

-- 3. A building manager confirms a resident's unit. The unit must match what the resident entered; nobody verifies themselves.
create or replace function public.verify_resident_unit(p_building uuid, p_user uuid, p_unit text)
returns void language plpgsql security definer set search_path='' as $$
declare m public.building_members; u text := trim(coalesce(p_unit, ''));
begin
  if not public.authorize('member.invite', p_building) then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if p_user = auth.uid() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  select * into m from public.building_members
   where building_id = p_building and user_id = p_user and status = 'active' and role = 'owner_resident' for update;
  if not found then raise exception 'forbidden' using errcode = 'P0001'; end if;
  if m.unit_number is null or m.unit_number <> u then raise exception 'unit_mismatch' using errcode = 'P0001'; end if;
  update public.building_members set unit_verified_at = now(), unit_verified_by = auth.uid()
   where id = m.id;
end $$;

revoke all on function public.verify_resident_unit(uuid, uuid, text) from public, anon;
grant execute on function public.verify_resident_unit(uuid, uuid, text) to authenticated;

-- 4. Residents read the in-force bylaws of their own building, and the sections those bylaws belong to. Drafts,
-- proposals and superseded versions stay with the managers (scoped_read, chat.use).
create policy resident_in_force_read on public.bylaw_versions for select to authenticated
  using (status = 'in_force' and public.authorize('building.read', building_id));

create policy resident_in_force_nodes_read on public.bylaw_nodes for select to authenticated
  using (
    public.authorize('building.read', building_id)
    and exists (select 1 from public.bylaw_versions v where v.node_id = bylaw_nodes.id and v.status = 'in_force')
  );
