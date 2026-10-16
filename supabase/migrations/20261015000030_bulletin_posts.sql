-- Create bulletin_posts table for building announcements
create table if not exists public.bulletin_posts (
  id uuid default gen_random_uuid() primary key,
  building_id uuid not null references public.buildings(id) on delete cascade,
  title text not null,
  body text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  pinned boolean default false not null,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.bulletin_posts enable row level security;

-- RLS: All users can read posts from their building
create policy "Users can read posts from their building"
  on public.bulletin_posts
  for select
  using (
    exists (
      select 1 from public.building_members
      where building_members.building_id = bulletin_posts.building_id
        and building_members.user_id = auth.uid()
        and building_members.status = 'active'
    )
  );

-- RLS: Only staff can create posts
create policy "Staff can create posts in their building"
  on public.bulletin_posts
  for insert
  with check (
    exists (
      select 1 from public.building_members
      where building_members.building_id = bulletin_posts.building_id
        and building_members.user_id = auth.uid()
        and building_members.role != 'owner_resident'
        and building_members.status = 'active'
    )
    and bulletin_posts.author_id = auth.uid()
  );

-- RLS: Authors and managers can update their posts
create policy "Authors and managers can update posts"
  on public.bulletin_posts
  for update
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.building_members
      where building_members.building_id = bulletin_posts.building_id
        and building_members.user_id = auth.uid()
        and building_members.role != 'owner_resident'
        and building_members.role != 'council_member'
        and building_members.status = 'active'
    )
  );

-- RLS: Authors and managers can delete posts
create policy "Authors and managers can delete posts"
  on public.bulletin_posts
  for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.building_members
      where building_members.building_id = bulletin_posts.building_id
        and building_members.user_id = auth.uid()
        and building_members.role != 'owner_resident'
        and building_members.role != 'council_member'
        and building_members.status = 'active'
    )
  );

-- Indexes for performance
create index idx_bulletin_posts_building_id on public.bulletin_posts(building_id);
create index idx_bulletin_posts_author_id on public.bulletin_posts(author_id);
create index idx_bulletin_posts_created_at on public.bulletin_posts(created_at desc);
create index idx_bulletin_posts_pinned on public.bulletin_posts(pinned desc);
create index idx_bulletin_posts_building_created on public.bulletin_posts(building_id, created_at desc);
create index idx_bulletin_posts_deleted_at on public.bulletin_posts(deleted_at);
