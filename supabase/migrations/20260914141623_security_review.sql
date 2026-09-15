-- Trigger entry points are never API operations.
revoke execute on function public.audit_change(),public.enforce_single_building(),public.handle_new_user(),public.validate_chat() from authenticated;
create function public.list_building_members(p_building uuid)
returns table(id uuid,building_id uuid,user_id uuid,name text,email text,role public.app_role,status text,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
 select m.id,m.building_id,m.user_id,p.display_name,u.email::text,m.role,m.status,m.expires_at
 from public.building_members m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id
 where m.building_id=p_building and public.has_building_access(p_building)
 and (public.authorize('member.read',p_building) or m.user_id=auth.uid());
$$;
revoke all on function public.list_building_members(uuid) from public,anon;
grant execute on function public.list_building_members(uuid) to authenticated;
