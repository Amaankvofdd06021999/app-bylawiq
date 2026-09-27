-- supabase/migrations/20260927091000_building_orgs.sql
-- Every building gets its own kind='building' organization. Firms reach buildings through firm_building_links.
-- Rollback (restores firm ownership for split buildings, then drop the functions below and re-apply the previous
-- definitions of bootstrap_workspace, create_building, user_org_ids, list_account_links_for_building, create_invitation):
--  update public.buildings b set org_id=l.firm_org_id from public.firm_building_links l
--   where l.building_id=b.id and l.status='active' and not exists(select 1 from public.org_members m where m.org_id=b.org_id);
drop trigger organizations_kind_from_member on public.org_members;
drop function private.set_org_kind();

create function private.create_firm_building(p_firm uuid,p_name text,p_plan text,p_address text,p_units integer) returns uuid language plpgsql security definer set search_path='' as $$
declare f public.organizations; o uuid; b uuid; l uuid;
begin
 select * into f from public.organizations where id=p_firm and kind='firm';
 if not found then raise exception 'forbidden'; end if;
 insert into public.organizations(name,created_by,kind,letterhead,signature_block,separation_of_duties)
 values(left(p_name,120),auth.uid(),'building',f.letterhead,f.signature_block,f.separation_of_duties) returning id into o;
 insert into public.buildings(org_id,name,strata_plan_no,address,unit_count) values(o,left(p_name,120),nullif(p_plan,''),coalesce(p_address,''),p_units) returning id into b;
 insert into public.firm_building_links(building_id,firm_org_id,status,invited_by,accepted_by,accepted_at) values(b,p_firm,'active',auth.uid(),auth.uid(),now()) returning id into l;
 perform private.add_link_members(l);
 return b;
end; $$;

create or replace function public.bootstrap_workspace(p_name text,p_account_type public.account_type,p_building_name text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare o uuid; b uuid; r public.app_role;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 perform 1 from public.profiles where id=auth.uid() and account_type is null for update;
 if not found then raise exception 'already_configured'; end if;
 if length(p_name)<2 or length(p_building_name)<2 then raise exception 'invalid_input'; end if;
 update public.profiles set account_type=p_account_type,display_name=left(p_display_name,100),consent_at=now() where id=auth.uid();
 r:=case p_account_type when 'admin' then 'org_owner'::public.app_role when 'multi_building' then 'portfolio_manager'::public.app_role else 'building_manager'::public.app_role end;
 if p_account_type='single_building' then
  insert into public.organizations(name,created_by,kind) values(left(p_name,120),auth.uid(),'building') returning id into o;
  insert into public.org_members(org_id,user_id,role) values(o,auth.uid(),r);
  insert into public.buildings(org_id,name) values(o,left(p_building_name,120)) returning id into b;
  insert into public.building_members(building_id,user_id,role) values(b,auth.uid(),r);
 else
  insert into public.organizations(name,created_by,kind) values(left(p_name,120),auth.uid(),'firm') returning id into o;
  insert into public.org_members(org_id,user_id,role) values(o,auth.uid(),r);
  b:=private.create_firm_building(o,p_building_name,null,'',null);
 end if;
 return b;
end; $$;

create or replace function public.create_building(p_org_id uuid,p_name text,p_plan text,p_address text,p_units integer) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.org_members m join public.profiles p on p.id=m.user_id join public.organizations o on o.id=m.org_id
  where m.org_id=p_org_id and m.user_id=auth.uid() and m.status='active' and o.kind='firm' and p.account_type<>'single_building' and m.role in ('org_owner','org_admin','portfolio_manager')) then raise exception 'forbidden'; end if;
 if length(coalesce(p_name,''))<2 then raise exception 'invalid_input'; end if;
 return private.create_firm_building(p_org_id,p_name,p_plan,p_address,p_units);
end; $$;

-- One-time move of buildings that still sit inside a firm organization. Returns how many moved.
create function private.split_firm_buildings() returns integer language plpgsql security definer set search_path='' as $$
declare r record; o uuid; l uuid; n integer:=0;
begin
 for r in select b.id,b.name,f.id firm,f.created_by,f.letterhead,f.signature_block,f.separation_of_duties
  from public.buildings b join public.organizations f on f.id=b.org_id where f.kind='firm' loop
  insert into public.organizations(name,created_by,kind,letterhead,signature_block,separation_of_duties)
  values(r.name,r.created_by,'building',r.letterhead,r.signature_block,r.separation_of_duties) returning id into o;
  update public.buildings set org_id=o where id=r.id;
  insert into public.firm_building_links(building_id,firm_org_id,status,accepted_at) values(r.id,r.firm,'active',now()) returning id into l;
  update public.building_members set via_link_id=l where building_id=r.id and user_id in (select user_id from public.org_members where org_id=r.firm and role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant'));
  n:=n+1;
 end loop;
 return n;
end; $$;
select private.split_firm_buildings();

-- Organization oversight follows the firm that manages a building, not only the building's own organization.
create or replace function public.user_org_ids(p_user uuid) returns setof uuid language sql stable security definer set search_path='' as $$
 select org_id from public.org_members where user_id=p_user
 union select b.org_id from public.building_members m join public.buildings b on b.id=m.building_id where m.user_id=p_user
 union select l.firm_org_id from public.building_members m join public.firm_building_links l on l.building_id=m.building_id and l.status='active' where m.user_id=p_user and m.via_link_id is null; $$;
create or replace function public.list_account_links_for_building(p_building uuid) returns table(id uuid,first_account text,second_account text,created_at timestamptz,expires_at timestamptz,revoked_at timestamptz) language sql stable security definer set search_path='' as $$
 select l.id,pa.display_name||' · '||ua.email::text,pb.display_name||' · '||ub.email::text,l.created_at,l.expires_at,l.revoked_at
 from public.linked_accounts l
 join public.profiles pa on pa.id=l.user_a join auth.users ua on ua.id=l.user_a
 join public.profiles pb on pb.id=l.user_b join auth.users ub on ub.id=l.user_b
 where exists(select 1 from public.buildings b where b.id=p_building and b.deleted_at is null)
 and exists(select 1 from public.managing_org_ids(p_building) as o(org_id) where public.is_org_admin(o.org_id)
  and (o.org_id in (select public.user_org_ids(l.user_a)) or o.org_id in (select public.user_org_ids(l.user_b))))
 order by l.created_at desc; $$;

-- Same-organization warning now means "managed by the same organization or firm".
create or replace function public.create_invitation(p_building uuid,p_email text,p_role public.app_role,p_hash text,p_expires timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 if not public.authorize('member.invite',p_building) or not public.can_assign(p_building,p_role) then raise exception 'forbidden'; end if;
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and m.status='active' and (m.expires_at is null or m.expires_at>now())) then raise exception 'already_member'; end if;
 -- Leftover rows from a revoked firm link do not block re-inviting that person as an ordinary member.
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and m.via_link_id is null and not public.can_assign(p_building,m.role)) then raise exception 'forbidden'; end if;
 if exists(select 1 from auth.users u join public.profiles p on p.id=u.id
  where lower(u.email)=lower(trim(p_email)) and p.account_type='single_building' and p.bound_building_id<>p_building
  and exists(select 1 from public.managing_org_ids(p.bound_building_id) as x(org_id) where x.org_id in (select public.managing_org_ids(p_building)))) then raise exception 'single_building_conflict'; end if;
 if p_role='external_counsel' and (p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days') then raise exception 'expiry_required'; end if;
 insert into public.invitations(building_id,email,role,invited_by,token_hash,membership_expires_at) values(p_building,lower(trim(p_email)),p_role,auth.uid(),p_hash,p_expires) returning id into i;
 return i;
end; $$;

-- Letterhead of the firm managing the building, otherwise the building's own organization.
create function public.building_letterhead(p_building uuid) returns table(letterhead text,signature_block text) language sql stable security definer set search_path='' as $$
 select o.letterhead,o.signature_block from public.buildings b
 join public.organizations o on o.id=coalesce(public.linked_firm_id(b.id),b.org_id)
 where b.id=p_building and public.authorize('chat.use',p_building); $$;
revoke all on function private.create_firm_building(uuid,text,text,text,integer),private.split_firm_buildings() from public,anon,authenticated;
revoke all on function public.building_letterhead(uuid) from public,anon;
grant execute on function public.building_letterhead(uuid) to authenticated;
