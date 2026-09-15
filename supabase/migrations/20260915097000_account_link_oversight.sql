-- Linked accounts were visible and revocable only by their two owners, and link, switch and unlink audit rows
-- had no organization, so no admin could see them. PRD §3.3 requires links to be visible to org admins and
-- revocable. Admins of an organization either account belongs to can now see, list and revoke a link, and each
-- event is written to the audit log of every such organization. Revoking without the right to do so now fails
-- instead of recording an unlink that changed nothing.
create function public.user_org_ids(p_user uuid) returns setof uuid language sql stable security definer set search_path='' as $$
 select org_id from public.org_members where user_id=p_user
 union select b.org_id from public.building_members m join public.buildings b on b.id=m.building_id where m.user_id=p_user; $$;
create function public.oversees_user(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_org_ids(p_user) as o(org_id) where public.is_org_admin(o.org_id)); $$;
create function public.log_account_event(p_action text,p_link uuid,p_a uuid,p_b uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_log(actor_id,org_id,action,target_id)
 select auth.uid(),o.org_id,p_action,p_link from (select x.org_id from public.user_org_ids(p_a) as x(org_id) union select y.org_id from public.user_org_ids(p_b) as y(org_id)) o;
 if not found then insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),p_action,p_link); end if;
end; $$;
drop policy own_links on public.linked_accounts;
create policy links_read on public.linked_accounts for select to authenticated using(auth.uid() in (user_a,user_b) or public.oversees_user(user_a) or public.oversees_user(user_b));
create or replace function public.link_verified_account(p_target uuid,p_timestamp bigint,p_signature text) returns uuid language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
 if auth.uid() is null or auth.uid()=p_target or abs(extract(epoch from now())-p_timestamp)>60 or not private.valid_signature('link:'||auth.uid()::text||':'||p_target::text||':'||p_timestamp,p_signature) then raise exception 'forbidden'; end if;
 insert into public.linked_accounts(user_a,user_b) values(least(auth.uid(),p_target),greatest(auth.uid(),p_target)) on conflict(user_a,user_b) do update set expires_at=now()+interval '30 days',revoked_at=null returning id into l;
 perform public.log_account_event('account.link',l,auth.uid(),p_target);return l;
end; $$;
create or replace function public.authorize_account_switch(p_link uuid,p_timestamp bigint,p_signature text) returns text language plpgsql security definer set search_path='' as $$
declare target uuid; em text;
begin
 if auth.uid() is null or abs(extract(epoch from now())-p_timestamp)>60 or not private.valid_signature('switch:'||auth.uid()::text||':'||p_link::text||':'||p_timestamp,p_signature) then raise exception 'forbidden'; end if;
 select case when user_a=auth.uid() then user_b else user_a end into target from public.linked_accounts where id=p_link and auth.uid() in (user_a,user_b) and expires_at>now() and revoked_at is null;
 if target is null then raise exception 'forbidden'; end if;
 select email into em from auth.users where id=target and email_confirmed_at is not null;
 perform public.log_account_event('account.switch',p_link,auth.uid(),target);return em;
end; $$;
create or replace function public.revoke_account_link(p_link uuid) returns void language plpgsql security definer set search_path='' as $$
declare lk public.linked_accounts;
begin
 select * into lk from public.linked_accounts where id=p_link and revoked_at is null for update;
 if not found or not (auth.uid() in (lk.user_a,lk.user_b) or public.oversees_user(lk.user_a) or public.oversees_user(lk.user_b)) then raise exception 'forbidden'; end if;
 update public.linked_accounts set revoked_at=now() where id=p_link;
 perform public.log_account_event('account.unlink',p_link,lk.user_a,lk.user_b);
end; $$;
create function public.list_account_links_for_building(p_building uuid) returns table(id uuid,first_account text,second_account text,created_at timestamptz,expires_at timestamptz,revoked_at timestamptz) language sql stable security definer set search_path='' as $$
 with org as (select b.org_id from public.buildings b where b.id=p_building and b.deleted_at is null)
 select l.id,pa.display_name||' · '||ua.email::text,pb.display_name||' · '||ub.email::text,l.created_at,l.expires_at,l.revoked_at
 from public.linked_accounts l cross join org
 join public.profiles pa on pa.id=l.user_a join auth.users ua on ua.id=l.user_a
 join public.profiles pb on pb.id=l.user_b join auth.users ub on ub.id=l.user_b
 where public.is_org_admin(org.org_id)
 and (org.org_id in (select public.user_org_ids(l.user_a)) or org.org_id in (select public.user_org_ids(l.user_b)))
 order by l.created_at desc; $$;
revoke all on function public.user_org_ids(uuid),public.log_account_event(text,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.oversees_user(uuid),public.list_account_links_for_building(uuid) from public,anon;
grant execute on function public.oversees_user(uuid),public.list_account_links_for_building(uuid) to authenticated;
