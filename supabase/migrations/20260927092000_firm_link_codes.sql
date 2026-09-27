-- supabase/migrations/20260927092000_firm_link_codes.sql
-- Firm codes: the building creates, a firm manager accepts once, the building revokes. Staff changes in the firm
-- follow automatically. Linked staff cannot archive the building or remove the people who can revoke them.
-- Rollback: drop trigger sync_firm_member on public.org_members; drop the functions created here; re-apply the previous
--  change_membership, archive_building, accept_invitation and private.add_link_members definitions.
create function public.create_firm_code(p_building uuid,p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if not public.authorize('building.link_firm',p_building) then raise exception 'forbidden'; end if;
 if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_input'; end if;
 if exists(select 1 from public.firm_building_links where building_id=p_building and status='active') then raise exception 'firm_already_linked'; end if;
 update public.link_codes set revoked_at=now() where building_id=p_building and kind='firm' and revoked_at is null and used_at is null;
 insert into public.link_codes(building_id,kind,code_hash,created_by,expires_at) values(p_building,'firm',p_hash,auth.uid(),now()+interval '7 days') returning id into c;
 return c;
end; $$;

create function public.accept_firm_code(p_hash text,p_firm_org uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.link_codes; l uuid;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.org_members m join public.organizations o on o.id=m.org_id where m.org_id=p_firm_org and m.user_id=auth.uid() and m.status='active' and o.kind='firm' and m.role in ('org_owner','org_admin','portfolio_manager')) then raise exception 'forbidden'; end if;
 select * into c from public.link_codes where code_hash=p_hash for update;
 if not found or c.used_at is not null then raise exception 'invalid_code'; end if;
 if c.kind<>'firm' then raise exception 'wrong_code_kind'; end if;
 if c.revoked_at is not null then raise exception 'revoked_code'; end if;
 if c.expires_at<=now() then raise exception 'expired_code'; end if;
 -- Ruling: an archived building cannot be linked to a firm, even with a still-valid code.
 if not exists(select 1 from public.buildings where id=c.building_id and deleted_at is null) then raise exception 'invalid_code'; end if;
 if exists(select 1 from public.firm_building_links where building_id=c.building_id and status='active') then raise exception 'firm_already_linked'; end if;
 insert into public.firm_building_links(building_id,firm_org_id,status,invited_by,accepted_by,accepted_at) values(c.building_id,p_firm_org,'active',c.created_by,auth.uid(),now()) returning id into l;
 update public.link_codes set used_at=now() where id=c.id;
 perform private.add_link_members(l);
 return c.building_id;
end; $$;

create function public.revoke_firm_link(p_building uuid) returns void language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
 if not public.authorize('building.link_firm',p_building) then raise exception 'forbidden'; end if;
 select id into l from public.firm_building_links where building_id=p_building and status='active' for update;
 if not found then raise exception 'no_firm_link'; end if;
 update public.firm_building_links set status='revoked',revoked_by=auth.uid(),revoked_at=now() where id=l;
 update public.building_members set status='suspended' where via_link_id=l;
 update public.link_codes set revoked_at=now() where building_id=p_building and kind='firm' and revoked_at is null and used_at is null;
end; $$;

create function public.building_firm_status(p_building uuid) returns table(status text,firm_name text,since timestamptz,code_expires_at timestamptz) language sql stable security definer set search_path='' as $$
 select case when l.id is not null then 'active' when c.id is not null then 'invited' else 'none' end,o.name,l.accepted_at,c.expires_at
 from (select 1) x
 left join public.firm_building_links l on l.building_id=p_building and l.status='active'
 left join public.organizations o on o.id=l.firm_org_id
 left join lateral (select id,expires_at from public.link_codes where building_id=p_building and kind='firm' and revoked_at is null and used_at is null and expires_at>now() order by created_at desc limit 1) c on true
 where public.authorize('member.read',p_building); $$;

-- Joining or leaving a firm updates access to every building the firm is linked to. Deleting the org_members row
-- (not just suspending it) must suspend access the same way.
-- Ruling: a firm link must not reactivate a membership the building itself suspended — only a link-owned row
-- (via_link_id already set) is revived here.
create function private.sync_firm_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  update public.building_members m set status='suspended' from public.firm_building_links l where m.via_link_id=l.id and l.firm_org_id=old.org_id and l.status='active' and m.user_id=old.user_id;
 elsif new.status='active' and new.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant') then
  insert into public.building_members(building_id,user_id,role,via_link_id)
  select l.building_id,new.user_id,new.role,l.id from public.firm_building_links l where l.firm_org_id=new.org_id and l.status='active'
  on conflict(building_id,user_id) do update set role=excluded.role,status='active',via_link_id=excluded.via_link_id,expires_at=null
  where public.building_members.via_link_id is not null;
 else
  update public.building_members m set status='suspended' from public.firm_building_links l where m.via_link_id=l.id and l.firm_org_id=new.org_id and m.user_id=new.user_id;
 end if;
 return coalesce(new,old);
end; $$;
create trigger sync_firm_member after insert or update or delete on public.org_members for each row execute function private.sync_firm_member();

-- Ruling: same as above — a firm link must not reactivate a membership the building itself suspended.
create or replace function private.add_link_members(p_link uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.firm_building_links;
begin
 select * into l from public.firm_building_links where id=p_link and status='active';
 if not found then return; end if;
 insert into public.building_members(building_id,user_id,role,via_link_id)
 select l.building_id,m.user_id,m.role,l.id from public.org_members m
 where m.org_id=l.firm_org_id and m.status='active' and m.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant')
 on conflict(building_id,user_id) do update set role=excluded.role,status='active',via_link_id=excluded.via_link_id,expires_at=null
 where public.building_members.via_link_id is not null;
end; $$;

create or replace function public.change_membership(p_id uuid,p_role public.app_role,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare m public.building_members;
begin
 select * into m from public.building_members where id=p_id for update;
 if not found or not public.authorize('member.update_role',m.building_id) then raise exception 'forbidden'; end if;
 -- New: firm access is granted and removed as a whole through the link (checked before rank, so the message is specific).
 if m.via_link_id is not null then raise exception 'linked_member'; end if;
 if m.user_id=auth.uid() or not public.can_assign(m.building_id,m.role) or not public.can_assign(m.building_id,p_role) then raise exception 'forbidden'; end if;
 -- New: linked firm staff cannot remove or demote the people who can revoke the firm.
 if m.role in ('building_manager','council_president') and exists(select 1 from public.building_members me where me.building_id=m.building_id and me.user_id=auth.uid() and me.via_link_id is not null) then raise exception 'forbidden'; end if;
 update public.building_members set role=p_role,status=case when p_remove then 'suspended' else 'active' end where id=p_id;
 -- All RLS checks consult live membership. Demotion/revocation takes effect on the very next statement.
end; $$;

create or replace function public.archive_building(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.authorize('building.delete',p_id) then raise exception 'forbidden'; end if;
 -- New: a linked firm cannot archive a building it does not own.
 if exists(select 1 from public.building_members where building_id=p_id and user_id=auth.uid() and via_link_id is not null) then raise exception 'forbidden'; end if;
 update public.buildings set deleted_at=now() where id=p_id;
end; $$;

create or replace function public.accept_invitation(p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; em text;
begin
 select email into em from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into i from public.invitations where token_hash=p_hash and email=lower(em) and expires_at>now() and accepted_at is null and revoked_at is null for update;
 if not found then raise exception 'invalid_invitation'; end if;
 update public.profiles set account_type=coalesce(account_type,case when i.role in ('org_admin','org_owner') then 'admin'::public.account_type when i.role in ('portfolio_manager','portfolio_assistant') then 'multi_building'::public.account_type else 'single_building'::public.account_type end),consent_at=now() where id=auth.uid();
 insert into public.building_members(building_id,user_id,role,expires_at) values(i.building_id,auth.uid(),i.role,i.membership_expires_at)
 on conflict(building_id,user_id) do update set role=excluded.role,status='active',expires_at=excluded.expires_at,via_link_id=null -- New: an invited person is an ordinary member
 where public.building_members.status<>'active' or (public.building_members.expires_at is not null and public.building_members.expires_at<=now());
 -- No row written means an active membership already exists; covers invitations issued before this guard.
 if not found then raise exception 'already_member'; end if;
 update public.invitations set accepted_at=now() where id=i.id;
 return i.building_id;
end; $$;

revoke all on function private.sync_firm_member() from public,anon,authenticated;
revoke all on function public.create_firm_code(uuid,text),public.accept_firm_code(text,uuid),public.revoke_firm_link(uuid),public.building_firm_status(uuid) from public,anon;
grant execute on function public.create_firm_code(uuid,text),public.accept_firm_code(text,uuid),public.revoke_firm_link(uuid),public.building_firm_status(uuid) to authenticated;
