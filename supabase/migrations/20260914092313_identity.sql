-- Initial, additive schema. Rollback: restore a pre-install backup; never run on existing customer tables.
create extension if not exists vector with schema public;
create extension if not exists pg_trgm with schema public;
create extension if not exists pgcrypto with schema extensions;

create type public.account_type as enum ('admin','multi_building','single_building');
create type public.app_role as enum ('platform_admin','org_owner','org_admin','portfolio_manager','portfolio_assistant','building_manager','council_president','council_member','external_counsel','owner_resident');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', account_type public.account_type,
 bound_building_id uuid, consent_at timestamptz, created_at timestamptz not null default now()
);
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 120),
 created_by uuid not null references auth.users(id), separation_of_duties boolean not null default true,
 letterhead text not null default '', signature_block text not null default '', plan text not null default 'pilot',
 created_at timestamptz not null default now()
);
create table public.org_members (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 user_id uuid not null references auth.users(id), role public.app_role not null,
 status text not null default 'active' check(status in ('active','suspended')),
 unique(org_id,user_id), check(role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant','building_manager'))
);
create index org_members_user_idx on public.org_members(user_id,status);
create table public.buildings (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 name text not null check(length(name) between 2 and 120), strata_plan_no text, address text not null default '',
 unit_count integer check(unit_count between 1 and 5000), municipality text not null default '',
 jurisdiction_chain uuid[] not null default '{}', corpus_version integer not null default 1,
 fiscal_year_end date, created_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,org_id)
);
create index buildings_org_idx on public.buildings(org_id) where deleted_at is null;
create unique index buildings_plan_idx on public.buildings(strata_plan_no) where strata_plan_no is not null and deleted_at is null;
alter table public.profiles add constraint profiles_bound_fk foreign key(bound_building_id) references public.buildings(id);
create table public.building_members (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id),
 user_id uuid not null references auth.users(id), role public.app_role not null,
 status text not null default 'active' check(status in ('active','suspended')),
 expires_at timestamptz, unique(building_id,user_id),
 check(role <> 'platform_admin'), check(role <> 'external_counsel' or expires_at is not null)
);
create index building_members_user_idx on public.building_members(user_id,status);
create index building_members_scope_idx on public.building_members(building_id,status);
create table public.role_permissions (role public.app_role not null, permission text not null, primary key(role,permission));
insert into public.role_permissions(role,permission)
select r::public.app_role,p from unnest(array['org_owner','org_admin','portfolio_manager','building_manager','council_president']) r
cross join unnest(array['building.read','vault.read','vault.upload','vault.delete','chat.use','bylaw.edit','bylaw.adopt','document.draft','document.approve','document.send','dispute.read','dispute.create','dispute.update','member.read','member.invite','member.update_role','member.remove','audit.read','agent.manage','agent.deploy']) p;
insert into public.role_permissions(role,permission)
select r::public.app_role,p from unnest(array['portfolio_assistant']) r cross join unnest(array['building.read','vault.read','vault.upload','chat.use','bylaw.edit','document.draft','dispute.read','dispute.create','dispute.update','member.read']) p;
insert into public.role_permissions(role,permission)
select r::public.app_role,p from unnest(array['council_member','external_counsel']) r cross join unnest(array['building.read','vault.read','chat.use','dispute.read','member.read']) p;
insert into public.role_permissions values ('owner_resident','building.read'),('owner_resident','vault.read');
insert into public.role_permissions(role,permission)
select r::public.app_role,p from unnest(array['org_owner','org_admin']) r cross join unnest(array['org.manage','building.create','building.update','building.delete','chat.use_portfolio']) p;
insert into public.role_permissions values ('portfolio_manager','building.create'),('portfolio_manager','chat.use_portfolio'),('org_owner','billing.manage');

create function public.is_org_member(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.org_members where org_id=p_org and user_id=(select auth.uid()) and status='active'); $$;
create function public.is_org_admin(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.org_members where org_id=p_org and user_id=(select auth.uid()) and status='active' and role in ('org_owner','org_admin')); $$;
create function public.has_building_access(p_building uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.building_members m join public.buildings b on b.id=m.building_id where m.building_id=p_building and m.user_id=(select auth.uid()) and m.status='active' and (m.expires_at is null or m.expires_at>now()) and b.deleted_at is null); $$;
create function public.authorize(p_permission text,p_building uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.building_members m join public.role_permissions p on p.role=m.role join public.buildings b on b.id=m.building_id
 where m.building_id=p_building and m.user_id=(select auth.uid()) and m.status='active' and (m.expires_at is null or m.expires_at>now()) and b.deleted_at is null and p.permission=p_permission); $$;
create function public.my_building_role(p_building uuid) returns public.app_role language sql stable security definer set search_path='' as $$
 select role from public.building_members where building_id=p_building and user_id=(select auth.uid()) and status='active' and (expires_at is null or expires_at>now()); $$;
create function public.enforce_single_building() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
 select * into p from public.profiles where id=new.user_id for update;
 if p.account_type='single_building' and new.status='active' then
  if p.bound_building_id is not null and p.bound_building_id<>new.building_id then raise exception 'single_building_bound'; end if;
  update public.profiles set bound_building_id=new.building_id where id=new.user_id;
 end if;
 return new;
end; $$;
create trigger enforce_single_building before insert or update on public.building_members for each row execute function public.enforce_single_building();

create table public.audit_log (
 id bigint generated always as identity primary key, actor_id uuid, org_id uuid, building_id uuid,
 action text not null, target_id uuid, occurred_at timestamptz not null default now(), metadata jsonb not null default '{}'
);
create index audit_scope_idx on public.audit_log(building_id,occurred_at desc);
create index audit_org_idx on public.audit_log(org_id,occurred_at desc);
create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb:=to_jsonb(new); b uuid; o uuid;
begin
 b:=nullif(j->>'building_id','')::uuid;
 if tg_table_name='buildings' then b:=(j->>'id')::uuid; end if;
 o:=nullif(j->>'org_id','')::uuid;
 if o is null and b is not null then select org_id into o from public.buildings where id=b; end if;
 insert into public.audit_log(actor_id,org_id,building_id,action,target_id) values(auth.uid(),o,b,tg_table_name||'.'||lower(tg_op),(j->>'id')::uuid);
 return new;
end; $$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.buildings enable row level security;
alter table public.building_members enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_log enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy org_read on public.organizations for select to authenticated using(public.is_org_member(id));
create policy org_update on public.organizations for update to authenticated using(public.is_org_admin(id)) with check(public.is_org_admin(id));
create policy org_members_read on public.org_members for select to authenticated using(public.is_org_member(org_id));
create policy buildings_read on public.buildings for select to authenticated using(public.has_building_access(id));
create policy buildings_update on public.buildings for update to authenticated using(public.authorize('building.update',id)) with check(public.authorize('building.update',id));
create policy members_read on public.building_members for select to authenticated using(user_id=(select auth.uid()) or public.authorize('member.read',building_id));
create policy permissions_read on public.role_permissions for select to authenticated using(true);
create policy audit_read on public.audit_log for select to authenticated using(public.authorize('audit.read',building_id) or public.is_org_admin(org_id));
grant select on public.profiles,public.organizations,public.org_members,public.buildings,public.building_members,public.role_permissions,public.audit_log to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(name,letterhead,signature_block) on public.organizations to authenticated;
grant update(name,address,unit_count,fiscal_year_end,municipality) on public.buildings to authenticated;
create trigger audit_buildings after insert or update on public.buildings for each row execute function public.audit_change();
create trigger audit_members after insert or update on public.building_members for each row execute function public.audit_change();
create trigger audit_org after update on public.organizations for each row execute function public.audit_change();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id) values(new.id); return new; end; $$;
create trigger create_profile after insert on auth.users for each row execute function public.handle_new_user();

create function public.bootstrap_workspace(p_name text,p_account_type public.account_type,p_building_name text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare o uuid; b uuid; r public.app_role;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 perform 1 from public.profiles where id=auth.uid() and account_type is null for update;
 if not found then raise exception 'already_configured'; end if;
 if length(p_name)<2 or length(p_building_name)<2 then raise exception 'invalid_input'; end if;
 update public.profiles set account_type=p_account_type,display_name=left(p_display_name,100),consent_at=now() where id=auth.uid();
 insert into public.organizations(name,created_by) values(left(p_name,120),auth.uid()) returning id into o;
 r:=case p_account_type when 'admin' then 'org_owner'::public.app_role when 'multi_building' then 'portfolio_manager'::public.app_role else 'building_manager'::public.app_role end;
 insert into public.org_members(org_id,user_id,role) values(o,auth.uid(),r);
 insert into public.buildings(org_id,name) values(o,left(p_building_name,120)) returning id into b;
 insert into public.building_members(building_id,user_id,role) values(b,auth.uid(),r);
 return b;
end; $$;

create function public.create_building(p_org_id uuid,p_name text,p_plan text,p_address text,p_units integer) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; r public.app_role;
begin
 select m.role into r from public.org_members m join public.profiles p on p.id=m.user_id where m.org_id=p_org_id and m.user_id=auth.uid() and m.status='active' and p.account_type<>'single_building' and m.role in ('org_owner','org_admin','portfolio_manager');
 if r is null then raise exception 'forbidden'; end if;
 insert into public.buildings(org_id,name,strata_plan_no,address,unit_count) values(p_org_id,p_name,nullif(p_plan,''),p_address,p_units) returning id into b;
 insert into public.building_members(building_id,user_id,role)
 select b,user_id,role from public.org_members where org_id=p_org_id and status='active' and role in ('org_owner','org_admin');
 insert into public.building_members(building_id,user_id,role) values(b,auth.uid(),r) on conflict(building_id,user_id) do nothing;
 return b;
end; $$;
create function public.archive_building(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not public.authorize('building.delete',p_id) then raise exception 'forbidden'; end if;
 update public.buildings set deleted_at=now() where id=p_id; end; $$;

create function public.custom_access_token_hook(event jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=event->'claims'; metadata jsonb; memberships jsonb; typ public.account_type;
begin
 select account_type into typ from public.profiles where id=(event->>'user_id')::uuid;
 select coalesce(jsonb_object_agg(building_id::text,role::text),'{}') into memberships from public.building_members where user_id=(event->>'user_id')::uuid and status='active' and (expires_at is null or expires_at>now());
 metadata:=coalesce(claims->'app_metadata','{}')||jsonb_build_object('account_type',typ,'buildings',memberships);
 return jsonb_set(event,'{claims}',jsonb_set(claims,'{app_metadata}',metadata));
end; $$;
revoke all on function public.custom_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke all on function public.bootstrap_workspace(text,public.account_type,text,text),public.create_building(uuid,text,text,text,integer),public.archive_building(uuid) from public,anon;
grant execute on function public.bootstrap_workspace(text,public.account_type,text,text),public.create_building(uuid,text,text,text,integer),public.archive_building(uuid) to authenticated;
