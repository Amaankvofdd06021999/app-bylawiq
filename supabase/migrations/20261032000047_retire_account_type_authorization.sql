-- Decision D3 (+ D17): profiles.account_type no longer decides authorization or creation rules.
-- The single-building product constraint is carried by profiles.bound_building_id alone.
--
-- Rules after this migration:
--   * A single-building account is one whose bound_building_id is set. The constraint: such an account may be an active
--     member of only that building (enforced by enforce_single_building).
--   * enforce_single_building binds an account to its first building role when the account has no firm or portfolio
--     standing (no org_members row) and its role is a building role. Portfolio and firm roles never bind. This keeps
--     the previous behaviour for residents and building staff, without reading account_type.
--   * bootstrap_workspace chooses the creation path from its p_account_type argument (onboarding input only), stores
--     nothing in account_type, marks the profile configured with consent_at, and binds single-building accounts
--     explicitly (their organisation row would otherwise look like firm standing).
--   * accept_invitation no longer sets account_type.
--   * create_building and create_invitation check bound_building_id instead of account_type.
-- The account_type column itself is kept for now and is dropped in a later migration, after the app stops reading it.
--
-- Rollback: recreate the five functions from their previous definitions (20260914092517_members_and_retrieval.sql,
-- 20260927092000_firm_link_codes.sql, the bootstrap/accept definitions in 20260914092313_identity.sql and the firm
-- migrations). No data changes in this migration.

create or replace function public.bootstrap_workspace(p_name text, p_account_type account_type, p_building_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare o uuid; b uuid; r public.app_role;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 perform 1 from public.profiles where id=auth.uid() and consent_at is null for update;
 if not found then raise exception 'already_configured'; end if;
 if length(p_name)<2 or length(p_building_name)<2 then raise exception 'invalid_input'; end if;
 update public.profiles set display_name=left(p_display_name,100),consent_at=now() where id=auth.uid();
 r:=case p_account_type when 'admin' then 'org_owner'::public.app_role when 'multi_building' then 'portfolio_manager'::public.app_role else 'building_manager'::public.app_role end;
 if p_account_type='single_building' then
  insert into public.organizations(name,created_by,kind) values(left(p_name,120),auth.uid(),'building') returning id into o;
  insert into public.org_members(org_id,user_id,role) values(o,auth.uid(),r);
  insert into public.buildings(org_id,name) values(o,left(p_building_name,120)) returning id into b;
  update public.profiles set bound_building_id=b where id=auth.uid();
  insert into public.building_members(building_id,user_id,role) values(b,auth.uid(),r);
 else
  insert into public.organizations(name,created_by,kind) values(left(p_name,120),auth.uid(),'firm') returning id into o;
  insert into public.org_members(org_id,user_id,role) values(o,auth.uid(),r);
  b:=private.create_firm_building(o,p_building_name,null,'',null);
 end if;
 return b;
end; $$;

create or replace function public.enforce_single_building()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
 select * into p from public.profiles where id=new.user_id for update;
 if new.status='active' and p.bound_building_id is not null and p.bound_building_id<>new.building_id then
   raise exception 'single_building_bound';
 end if;
 if new.status='active' and p.bound_building_id is null
    and new.role not in ('org_owner','org_admin','portfolio_manager','portfolio_assistant')
    and not exists(select 1 from public.org_members om where om.user_id=new.user_id and om.status='active') then
   update public.profiles set bound_building_id=new.building_id where id=new.user_id;
 end if;
 return new;
end; $$;

create or replace function public.accept_invitation(p_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; em text;
begin
 select email into em from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into i from public.invitations where token_hash=p_hash and email=lower(em) and expires_at>now() and accepted_at is null and revoked_at is null for update;
 if not found then raise exception 'invalid_invitation'; end if;
 update public.profiles set consent_at=now() where id=auth.uid();
 insert into public.building_members(building_id,user_id,role,expires_at) values(i.building_id,auth.uid(),i.role,i.membership_expires_at)
 on conflict(building_id,user_id) do update set role=excluded.role,status='active',expires_at=excluded.expires_at,via_link_id=null -- New: an invited person is an ordinary member
 where public.building_members.status<>'active' or (public.building_members.expires_at is not null and public.building_members.expires_at<=now());
 -- No row written means an active membership already exists; covers invitations issued before this guard.
 if not found then raise exception 'already_member'; end if;
 update public.invitations set accepted_at=now() where id=i.id;
 return i.building_id;
end; $$;

create or replace function public.create_building(p_org_id uuid, p_name text, p_plan text, p_address text, p_units integer)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.org_members m join public.profiles p on p.id=m.user_id join public.organizations o on o.id=m.org_id
  where m.org_id=p_org_id and m.user_id=auth.uid() and m.status='active' and o.kind='firm' and p.bound_building_id is null and m.role in ('org_owner','org_admin','portfolio_manager')) then raise exception 'forbidden'; end if;
 if length(coalesce(p_name,''))<2 then raise exception 'invalid_input'; end if;
 return private.create_firm_building(p_org_id,p_name,p_plan,p_address,p_units);
end; $$;

create or replace function public.create_invitation(p_building uuid, p_email text, p_role app_role, p_hash text, p_expires timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 if not public.authorize('member.invite',p_building) or not public.can_assign(p_building,p_role) then raise exception 'forbidden'; end if;
 -- Linked firm staff may only invite roles that stay under the building's control; anything else would outlive a revoke.
 if p_role not in ('council_member','external_counsel') and exists(select 1 from public.building_members where building_id=p_building and user_id=auth.uid() and via_link_id is not null and status='active') then raise exception 'forbidden'; end if;
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and m.status='active' and (m.expires_at is null or m.expires_at>now())) then raise exception 'already_member'; end if;
 -- Leftover rows from a revoked firm link do not block re-inviting that person as an ordinary member.
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and m.via_link_id is null and not public.can_assign(p_building,m.role)) then raise exception 'forbidden'; end if;
 if exists(select 1 from auth.users u join public.profiles p on p.id=u.id
  where lower(u.email)=lower(trim(p_email)) and p.bound_building_id is not null and p.bound_building_id<>p_building
  and exists(select 1 from public.managing_org_ids(p.bound_building_id) as x(org_id) where x.org_id in (select public.managing_org_ids(p_building)))) then raise exception 'single_building_conflict'; end if;
 if p_role='external_counsel' and (p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days') then raise exception 'expiry_required'; end if;
 insert into public.invitations(building_id,email,role,invited_by,token_hash,membership_expires_at) values(p_building,lower(trim(p_email)),p_role,auth.uid(),p_hash,p_expires) returning id into i;
 return i;
end; $$;
