-- Invitations must never change an existing member's role. Previously accept_invitation upserted the invited
-- role over any existing membership, so a council president could demote an org admin by inviting their email.
-- Role changes for existing members go through change_membership, which applies the assignment guards.
create or replace function public.create_invitation(p_building uuid,p_email text,p_role public.app_role,p_hash text,p_expires timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 if not public.authorize('member.invite',p_building) or not public.can_assign(p_building,p_role) then raise exception 'forbidden'; end if;
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and m.status='active' and (m.expires_at is null or m.expires_at>now())) then raise exception 'already_member'; end if;
 -- A suspended or expired membership may only be revived by someone allowed to assign its current role.
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and not public.can_assign(p_building,m.role)) then raise exception 'forbidden'; end if;
 if exists(select 1 from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(p_email) and p.account_type='single_building' and p.bound_building_id<>p_building) then raise exception 'single_building_conflict'; end if;
 if p_role='external_counsel' and (p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days') then raise exception 'expiry_required'; end if;
 insert into public.invitations(building_id,email,role,invited_by,token_hash,membership_expires_at) values(p_building,lower(trim(p_email)),p_role,auth.uid(),p_hash,p_expires) returning id into i;
 return i;
end; $$;
create or replace function public.accept_invitation(p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; em text;
begin
 select email into em from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into i from public.invitations where token_hash=p_hash and email=lower(em) and expires_at>now() and accepted_at is null and revoked_at is null for update;
 if not found then raise exception 'invalid_invitation'; end if;
 update public.profiles set account_type=coalesce(account_type,case when i.role in ('org_admin','org_owner') then 'admin'::public.account_type when i.role in ('portfolio_manager','portfolio_assistant') then 'multi_building'::public.account_type else 'single_building'::public.account_type end),consent_at=now() where id=auth.uid();
 insert into public.building_members(building_id,user_id,role,expires_at) values(i.building_id,auth.uid(),i.role,i.membership_expires_at)
 on conflict(building_id,user_id) do update set role=excluded.role,status='active',expires_at=excluded.expires_at
 where public.building_members.status<>'active' or (public.building_members.expires_at is not null and public.building_members.expires_at<=now());
 -- No row written means an active membership already exists; covers invitations issued before this guard.
 if not found then raise exception 'already_member'; end if;
 update public.invitations set accepted_at=now() where id=i.id;
 return i.building_id;
end; $$;
