-- Time-limited external counsel access to one bylaw amendment (PRD §7.4). Counsel reads the amendment and its history while a
-- grant is active. Counsel cannot write, approve, adopt or file. Grants last at most 30 days, are recorded, and can be revoked.
--
-- Rollback: supabase/rollbacks/20261047000063_counsel_access.down.sql.

create table public.counsel_grants (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  bylaw_version_id uuid not null,
  counsel_user_id uuid not null references auth.users(id),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  foreign key (bylaw_version_id, building_id) references public.bylaw_versions(id, building_id),
  check (expires_at > granted_at),
  check (expires_at <= granted_at + interval '30 days')
);

create index counsel_grants_version_idx on public.counsel_grants(bylaw_version_id);
create index counsel_grants_counsel_idx on public.counsel_grants(counsel_user_id);
create index counsel_grants_scope_idx on public.counsel_grants(building_id);

-- One active grant per counsel per amendment.
create unique index counsel_grants_active_idx on public.counsel_grants(bylaw_version_id, counsel_user_id) where revoked_at is null;

alter table public.counsel_grants enable row level security;

-- Counsel sees their own grants. Managers who may adopt see every grant for their building.
create policy counsel_grants_read on public.counsel_grants for select to authenticated
  using (counsel_user_id = auth.uid() or public.authorize('bylaw.adopt', building_id));
grant select on public.counsel_grants to authenticated;

-- No direct writes. Grants are made and revoked through the functions below.
revoke insert, update, delete on public.counsel_grants from authenticated, anon;

-- Counsel reads the granted amendment while the grant is active. Nothing else opens to counsel.
create policy counsel_read_version on public.bylaw_versions for select to authenticated
  using (exists (
    select 1 from public.counsel_grants g
    where g.bylaw_version_id = bylaw_versions.id
      and g.counsel_user_id = auth.uid()
      and g.revoked_at is null
      and g.expires_at > now()
  ));

create policy counsel_read_node on public.bylaw_nodes for select to authenticated
  using (exists (
    select 1 from public.bylaw_versions v
    join public.counsel_grants g on g.bylaw_version_id = v.id
    where v.node_id = bylaw_nodes.id
      and g.counsel_user_id = auth.uid()
      and g.revoked_at is null
      and g.expires_at > now()
  ));

-- Grant: a manager who may adopt names a counsel and a period of 1 to 30 days for one amendment in their building.
create function public.grant_counsel_access(p_version uuid, p_counsel uuid, p_days integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.bylaw_versions; g uuid;
begin
  select * into v from public.bylaw_versions where id = p_version;
  if not found or not public.authorize('bylaw.adopt', v.building_id) then raise exception 'forbidden'; end if;
  if p_days is null or p_days < 1 or p_days > 30 then raise exception 'invalid_period'; end if;
  if p_counsel is null then raise exception 'counsel_required'; end if;
  insert into public.counsel_grants (building_id, bylaw_version_id, counsel_user_id, granted_by, expires_at)
  values (v.building_id, v.id, p_counsel, auth.uid(), now() + make_interval(days => p_days))
  returning id into g;
  return g;
end; $$;

-- Revoke: a manager who may adopt ends a grant for their building. The grant stays on record.
create function public.revoke_counsel_access(p_grant uuid) returns void
language plpgsql security definer set search_path='' as $$
declare gr public.counsel_grants;
begin
  select * into gr from public.counsel_grants where id = p_grant for update;
  if not found or not public.authorize('bylaw.adopt', gr.building_id) then raise exception 'forbidden'; end if;
  if gr.revoked_at is not null then raise exception 'already_revoked'; end if;
  update public.counsel_grants set revoked_at = now() where id = p_grant;
end; $$;

revoke all on function public.grant_counsel_access(uuid, uuid, integer) from public, anon;
revoke all on function public.revoke_counsel_access(uuid) from public, anon;
grant execute on function public.grant_counsel_access(uuid, uuid, integer) to authenticated;
grant execute on function public.revoke_counsel_access(uuid) to authenticated;
