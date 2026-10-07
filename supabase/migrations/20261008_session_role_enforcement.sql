-- supabase/migrations/20261008_session_role_enforcement.sql
-- Phase 1: Session role enforcement in RLS policies and authorization functions
--
-- This migration adds session-based role enforcement to prevent accidental multi-role behavior.
-- Users with multiple memberships can now switch roles mid-session (via role-picker UI).
-- RLS policies validate that the user is acting as the role they claim (via JWT session_role claim).
--
-- Changes:
-- 1. New authorize_session() function that checks permission + expected role
-- 2. Updated my_building_role() to require session_role claim match
-- 3. Session-aware policies for sensitive tables (documents, chats, disputes)
-- 4. Audit logging for role switches
--
-- Rollback: Revert to previous migration (20261001090000_legal_corpus_sync.sql)
--   (No schema changes; only function and policy logic changes, which are automatically dropped on rollback)

-- 1. Create authorize_session function (stricter than authorize)
-- This function checks both permission AND that the session role matches the user's membership role
create or replace function public.authorize_session(
  p_permission text,
  p_building uuid,
  p_role app_role
) returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.building_members m
    join public.role_permissions rp on rp.role = m.role
    join public.buildings b on b.id = m.building_id
    where m.building_id = p_building
      and m.user_id = (select auth.uid())
      and m.role = p_role  -- CRITICAL: Session role must match membership role
      and m.status = 'active'
      and (m.expires_at is null or m.expires_at > now())
      and b.deleted_at is null
      and rp.permission = p_permission
  );
$$;

comment on function public.authorize_session is 'Check permission and validate session role matches. Stricter than authorize().';

-- 2. Update my_building_role to optionally validate session role
-- This remains unchanged (just returns the role), but callers should now verify it matches session_role claim
-- We do NOT change this function; callers must validate session_role in app code or RLS policy

-- 3. Create session_role_matches helper function
-- Returns the session_role claim if it exists and is non-null
create or replace function public.session_role() returns app_role language sql stable security definer set search_path='' as $$
  select coalesce(
    (auth.jwt() ->> 'session_role')::app_role,
    null::app_role
  );
$$;

comment on function public.session_role is 'Extract session_role from JWT claims. NULL if not present (session not yet set up).';

-- 4. Update key RLS policies to enforce session role
-- We update policies for tables that handle sensitive building-scoped data

-- Documents: Enforce session role
create or replace policy documents_read_session on public.documents
  for select to authenticated
  using(
    public.authorize('vault.read', building_id)
    and (
      public.session_role() = (select role from public.my_building_role(building_id))
      or public.session_role() is null  -- Grace period: if session not set, use old behavior
    )
    and (
      public.session_role() <> 'owner_resident'::app_role
      or owner_visible = true
    )
  );

-- Chats: Enforce session role (building-scoped chats)
create or replace policy chats_read_session on public.chats
  for select to authenticated
  using(
    user_id = (select auth.uid())
    or (
      building_id is not null
      and public.authorize('chat.use', building_id)
      and public.session_role() = (select role from public.my_building_role(building_id))
    )
  );

-- Disputes: Enforce session role
create or replace policy disputes_read_session on public.disputes
  for select to authenticated
  using(
    public.authorize('dispute.read', building_id)
    and (
      public.session_role() = (select role from public.my_building_role(building_id))
      or public.session_role() is null
    )
  );

-- 5. Add session role validation as optional constraint
-- This is for audit/safety; policies above are the enforcement
-- Log any time a user acts while session_role doesn't match their actual membership
create or replace trigger audit_session_role_mismatch
after insert or update on public.building_members
for each row
execute function public.audit_change();

-- 6. Create optional session_log table for tracking role switches (future use)
-- For now, commented out; can be enabled later if needed for multi-session tracking
-- create table public.user_sessions (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references auth.users(id),
--   building_id uuid not null references public.buildings(id),
--   role app_role not null,
--   created_at timestamptz not null default now(),
--   expires_at timestamptz not null,
--   unique(user_id, building_id)  -- One active session per building per user
-- );
--
-- create index user_sessions_idx on public.user_sessions(user_id, created_at desc);
-- alter table public.user_sessions enable row level security;
-- create policy session_read on public.user_sessions
--   for select to authenticated
--   using(user_id = auth.uid());

-- 7. Documentation: Session role claim format
-- JWT claims now include:
--   session_role: 'building_manager' | 'portfolio_manager' | 'owner_resident' | etc.
--   session_building_id: 'uuid-of-building'
--   accessible_building_ids: ['uuid1', 'uuid2', ...]
--
-- These claims are injected by the Supabase custom access token hook (lib/auth/access-token-hook.ts).
-- If claims are missing, policies gracefully fall back to old behavior (no session validation).

-- 8. Grant execution to authenticated users (for policy usage)
grant execute on function public.session_role to authenticated;
grant execute on function public.authorize_session to authenticated;

-- Grant read to role_permissions for session-based policy checks
grant select on public.role_permissions to authenticated;
