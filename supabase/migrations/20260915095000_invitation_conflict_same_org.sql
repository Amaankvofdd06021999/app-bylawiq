-- create_invitation raised single_building_conflict for any single-building account bound to another building,
-- so anyone who can invite could learn whether an email has an account in a different organization. The
-- conversion prompt is kept for the inviter's own organization (PRD §3.3). For other organizations the
-- invitation is created normally and acceptance still fails through the single-building binding.
create or replace function public.create_invitation(p_building uuid,p_email text,p_role public.app_role,p_hash text,p_expires timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 if not public.authorize('member.invite',p_building) or not public.can_assign(p_building,p_role) then raise exception 'forbidden'; end if;
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and m.status='active' and (m.expires_at is null or m.expires_at>now())) then raise exception 'already_member'; end if;
 -- A suspended or expired membership may only be revived by someone allowed to assign its current role.
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and not public.can_assign(p_building,m.role)) then raise exception 'forbidden'; end if;
 if exists(select 1 from auth.users u join public.profiles p on p.id=u.id join public.buildings bound on bound.id=p.bound_building_id
  where lower(u.email)=lower(trim(p_email)) and p.account_type='single_building' and p.bound_building_id<>p_building
  and bound.org_id=(select org_id from public.buildings where id=p_building)) then raise exception 'single_building_conflict'; end if;
 if p_role='external_counsel' and (p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days') then raise exception 'expiry_required'; end if;
 insert into public.invitations(building_id,email,role,invited_by,token_hash,membership_expires_at) values(p_building,lower(trim(p_email)),p_role,auth.uid(),p_hash,p_expires) returning id into i;
 return i;
end; $$;
