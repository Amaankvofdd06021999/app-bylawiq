-- One MFA verification at a time per admin, shared by every server instance. The auth service revokes a user's sessions on
-- each verification attempt, and overlapping challenge and verify calls for the same factor can deadlock in its database.
-- A lease in the database is the coordination point: a verification takes the lease for its user before it calls the auth
-- service, and gives it back when it ends. A lease expires on its own, so a crashed request cannot block the admin.
--
-- Ownership: acquire returns a random token to the caller, and only that token can release the lease. A second authenticated
-- call (for example a direct RPC from the same account) cannot clear a lease it did not take. The lease table itself is not
-- readable or writable by authenticated users.
--
-- Rollback: drop functions public.acquire_mfa_verification(integer) and public.release_mfa_verification(uuid), and table
-- public.mfa_verification_leases.

drop function if exists public.release_mfa_verification();
drop function if exists public.acquire_mfa_verification(integer);
drop table if exists public.mfa_verification_leases;

create table public.mfa_verification_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.mfa_verification_leases enable row level security;
revoke all on table public.mfa_verification_leases from public, anon, authenticated;

create or replace function public.acquire_mfa_verification(p_ttl_seconds integer default 20)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid := (select auth.uid()); t uuid := gen_random_uuid();
begin
  if me is null then raise insufficient_privilege using message = 'Not signed in'; end if;
  if p_ttl_seconds < 1 or p_ttl_seconds > 60 then raise exception 'invalid_input' using errcode = 'P0001'; end if;
  -- Take a new lease, or take over one that has expired. An unexpired lease held by someone else is not taken.
  insert into public.mfa_verification_leases (user_id, token, expires_at)
  values (me, t, now() + make_interval(secs => p_ttl_seconds))
  on conflict (user_id) do update
    set token = excluded.token, expires_at = excluded.expires_at
    where public.mfa_verification_leases.expires_at <= now();
  if not found then return null; end if;
  return t;
end; $$;

create or replace function public.release_mfa_verification(p_token uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  -- Only the holder of the token releases the lease. A different token, or no lease, changes nothing.
  delete from public.mfa_verification_leases
   where user_id = (select auth.uid()) and token = p_token;
end; $$;

revoke all on function public.acquire_mfa_verification(integer) from public, anon;
revoke all on function public.release_mfa_verification(uuid) from public, anon;
grant execute on function public.acquire_mfa_verification(integer) to authenticated;
grant execute on function public.release_mfa_verification(uuid) to authenticated;
