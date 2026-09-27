-- supabase/migrations/20260927090000_firm_links_schema.sql
-- Phase 1 of docs/superpowers/specs/2026-09-27-roles-billing-design.md: buildings own their organization and
-- link a strata management firm. A link materializes building_members rows tagged via_link_id, so authorize()
-- and every existing policy keep working; revoking suspends exactly those rows.
-- Rollback: drop trigger organizations_kind_from_member on public.org_members; drop function private.set_org_kind();
--  drop function private.add_link_members(uuid); drop function public.managing_org_ids(uuid); drop function public.linked_firm_id(uuid);
--  alter table public.building_members drop column via_link_id; drop table public.link_codes; drop table public.firm_building_links;
--  alter table public.organizations drop column kind;
--  delete from public.role_permissions where permission in ('building.link_firm','review.act');
alter table public.organizations add column kind text not null default 'building' check(kind in ('building','firm'));
update public.organizations o set kind='firm' where exists(select 1 from public.org_members m where m.org_id=o.id and m.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant'));
-- Until bootstrap_workspace sets kind itself (next migration), an organization whose first member holds a firm role is a firm.
create function private.set_org_kind() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant') then update public.organizations set kind='firm' where id=new.org_id and kind<>'firm'; end if;
 return new;
end; $$;
create trigger organizations_kind_from_member after insert on public.org_members for each row execute function private.set_org_kind();

create table public.firm_building_links (
 id uuid primary key default gen_random_uuid(),
 building_id uuid not null references public.buildings(id),
 firm_org_id uuid not null references public.organizations(id),
 status text not null check(status in ('active','revoked')),
 invited_by uuid references auth.users(id), accepted_by uuid references auth.users(id), revoked_by uuid references auth.users(id),
 created_at timestamptz not null default now(), accepted_at timestamptz, revoked_at timestamptz,
 check(status<>'revoked' or revoked_at is not null)
);
create unique index firm_links_active_idx on public.firm_building_links(building_id) where status='active';
create index firm_links_building_idx on public.firm_building_links(building_id);
create index firm_links_firm_idx on public.firm_building_links(firm_org_id,status);

create table public.link_codes (
 id uuid primary key default gen_random_uuid(),
 building_id uuid not null references public.buildings(id),
 kind text not null check(kind in ('firm','resident')),
 code_hash text not null unique check(code_hash ~ '^[0-9a-f]{64}$'),
 created_by uuid not null references auth.users(id),
 expires_at timestamptz not null, used_at timestamptz, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index link_codes_building_idx on public.link_codes(building_id,kind);

alter table public.building_members add column via_link_id uuid references public.firm_building_links(id);
create index building_members_link_idx on public.building_members(via_link_id) where via_link_id is not null;

insert into public.role_permissions(role,permission) values
 ('building_manager','building.link_firm'),('council_president','building.link_firm'),
 ('org_owner','review.act'),('org_admin','review.act'),('portfolio_manager','review.act');

alter table public.firm_building_links enable row level security;
alter table public.link_codes enable row level security;
create policy firm_links_read on public.firm_building_links for select to authenticated using(public.authorize('member.read',building_id) or public.is_org_member(firm_org_id));
create policy link_codes_read on public.link_codes for select to authenticated using(public.authorize('building.link_firm',building_id) or (kind='resident' and public.authorize('member.invite',building_id)));
revoke all on public.firm_building_links,public.link_codes from public,anon,authenticated;
grant select on public.firm_building_links to authenticated;
grant select(id,building_id,kind,created_by,expires_at,used_at,revoked_at,created_at) on public.link_codes to authenticated;
create trigger audit_firm_links after insert or update on public.firm_building_links for each row execute function public.audit_change();

create function public.linked_firm_id(p_building uuid) returns uuid language sql stable security definer set search_path='' as $$
 select firm_org_id from public.firm_building_links where building_id=p_building and status='active'; $$;
create function public.managing_org_ids(p_building uuid) returns setof uuid language sql stable security definer set search_path='' as $$
 select org_id from public.buildings where id=p_building
 union select firm_org_id from public.firm_building_links where building_id=p_building and status='active'; $$;
-- Firm staff join the building with their firm role. An existing active personal membership is left untouched.
create function private.add_link_members(p_link uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.firm_building_links;
begin
 select * into l from public.firm_building_links where id=p_link and status='active';
 if not found then return; end if;
 insert into public.building_members(building_id,user_id,role,via_link_id)
 select l.building_id,m.user_id,m.role,l.id from public.org_members m
 where m.org_id=l.firm_org_id and m.status='active' and m.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant')
 on conflict(building_id,user_id) do update set role=excluded.role,status='active',via_link_id=excluded.via_link_id,expires_at=null
 where public.building_members.via_link_id is not null or public.building_members.status<>'active';
end; $$;
revoke all on function private.add_link_members(uuid),private.set_org_kind() from public,anon,authenticated;
revoke all on function public.linked_firm_id(uuid),public.managing_org_ids(uuid) from public,anon;
grant execute on function public.linked_firm_id(uuid),public.managing_org_ids(uuid) to authenticated;
