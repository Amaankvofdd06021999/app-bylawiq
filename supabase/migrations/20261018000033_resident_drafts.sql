-- Resident drafting: saved drafts, and the owner-visible building passages a resident may cite.
-- A draft is written as 'pending', charged, then marked 'ready'; a pending draft that fails to charge is deleted.
-- Rollback: drop the policies, the resident_drafts table and the chunks policy created here.

create or replace function public.is_active_resident(p_building uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.building_members m
    where m.building_id = p_building
      and m.user_id = (select auth.uid())
      and m.role = 'owner_resident'::public.app_role
      and m.status = 'active'
  );
$$;
revoke execute on function public.is_active_resident(uuid) from public, anon;
grant execute on function public.is_active_resident(uuid) to authenticated;

create table public.resident_drafts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('notice_to_council', 'letter_reply')),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  title text not null,
  body text not null,
  meaning jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  credits_spent numeric not null default 0 check (credits_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resident_drafts_user_building_idx on public.resident_drafts(user_id, building_id, created_at desc);
create index resident_drafts_building_idx on public.resident_drafts(building_id);

alter table public.resident_drafts enable row level security;

create policy resident_drafts_read on public.resident_drafts
  for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident(building_id));

create policy resident_drafts_insert on public.resident_drafts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and public.is_active_resident(building_id));

create policy resident_drafts_update on public.resident_drafts
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_resident(building_id))
  with check (user_id = (select auth.uid()) and public.is_active_resident(building_id));

create policy resident_drafts_delete on public.resident_drafts
  for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');

revoke all on public.resident_drafts from anon, authenticated;
grant select, insert, update, delete on public.resident_drafts to authenticated;

create policy chunks_read_owner_visible on public.document_chunks
  for select to authenticated
  using (
    public.is_active_resident(building_id)
    and exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.owner_visible
        and d.status = 'ready'
        and d.deleted_at is null
        and (d.type <> 'bylaws' or d.structure_confirmed)
    )
  );
