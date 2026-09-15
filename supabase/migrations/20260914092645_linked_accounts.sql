create table public.linked_accounts (
 id uuid primary key default gen_random_uuid(), user_a uuid not null references auth.users(id),user_b uuid not null references auth.users(id),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 days',revoked_at timestamptz,
 check(user_a<user_b),unique(user_a,user_b)
);
alter table public.linked_accounts enable row level security;
create index linked_accounts_a_idx on public.linked_accounts(user_a);
create index linked_accounts_b_idx on public.linked_accounts(user_b);
create policy own_links on public.linked_accounts for select to authenticated using(auth.uid() in (user_a,user_b));
revoke all on public.linked_accounts from public,anon,authenticated;
grant select on public.linked_accounts to authenticated;
create function public.link_verified_account(p_target uuid,p_timestamp bigint,p_signature text) returns uuid language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
 if auth.uid() is null or auth.uid()=p_target or abs(extract(epoch from now())-p_timestamp)>60 or not private.valid_signature('link:'||auth.uid()::text||':'||p_target::text||':'||p_timestamp,p_signature) then raise exception 'forbidden'; end if;
 insert into public.linked_accounts(user_a,user_b) values(least(auth.uid(),p_target),greatest(auth.uid(),p_target)) on conflict(user_a,user_b) do update set expires_at=now()+interval '30 days',revoked_at=null returning id into l;
 insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),'account.link',l);return l;
end; $$;
create function public.list_linked_accounts() returns table(id uuid,label text,expires_at timestamptz) language sql stable security definer set search_path='' as $$
 select l.id,p.display_name||' · '||coalesce(b.name,'Workspace'),l.expires_at from public.linked_accounts l
 join public.profiles p on p.id=case when l.user_a=auth.uid() then l.user_b else l.user_a end
 left join public.buildings b on b.id=p.bound_building_id
 where auth.uid() in (l.user_a,l.user_b) and l.revoked_at is null and l.expires_at>now(); $$;
create function public.authorize_account_switch(p_link uuid,p_timestamp bigint,p_signature text) returns text language plpgsql security definer set search_path='' as $$
declare target uuid; em text;
begin
 if auth.uid() is null or abs(extract(epoch from now())-p_timestamp)>60 or not private.valid_signature('switch:'||auth.uid()::text||':'||p_link::text||':'||p_timestamp,p_signature) then raise exception 'forbidden'; end if;
 select case when user_a=auth.uid() then user_b else user_a end into target from public.linked_accounts where id=p_link and auth.uid() in (user_a,user_b) and expires_at>now() and revoked_at is null;
 if target is null then raise exception 'forbidden'; end if;
 select email into em from auth.users where id=target and email_confirmed_at is not null;
 insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),'account.switch',p_link);return em;
end; $$;
create function public.revoke_account_link(p_link uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.linked_accounts set revoked_at=now() where id=p_link and auth.uid() in (user_a,user_b);
 insert into public.audit_log(actor_id,action,target_id) values(auth.uid(),'account.unlink',p_link);
end; $$;
revoke all on function public.link_verified_account(uuid,bigint,text),public.list_linked_accounts(),public.authorize_account_switch(uuid,bigint,text),public.revoke_account_link(uuid) from public,anon;
grant execute on function public.link_verified_account(uuid,bigint,text),public.list_linked_accounts(),public.authorize_account_switch(uuid,bigint,text),public.revoke_account_link(uuid) to authenticated;
