-- External counsel: grant by email, and comments on the granted amendment only (PRD §7.4).
--
-- Email lookup is a deliberate exception to the directory rule: a manager who may adopt names counsel by email. The function
-- returns only a grant or a single refusal, and never the account's details. It reveals whether an account exists to that
-- manager, which a security review must accept (docs/SECURITY-REVIEW-COUNSEL-ACCESS.md).
--
-- Rollback: supabase/rollbacks/20261048000064_counsel_packet.down.sql.

create function public.grant_counsel_access_by_email(p_version uuid, p_email text, p_days integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.bylaw_versions; target uuid;
begin
  select * into v from public.bylaw_versions where id = p_version;
  if not found or not public.authorize('bylaw.adopt', v.building_id) then raise exception 'forbidden'; end if;
  select u.id into target from auth.users u where lower(u.email) = lower(trim(coalesce(p_email, ''))) limit 1;
  if target is null then raise exception 'counsel_account_required'; end if;
  return public.grant_counsel_access(p_version, target, p_days);
end; $$;

revoke all on function public.grant_counsel_access_by_email(uuid, text, integer) from public, anon;
grant execute on function public.grant_counsel_access_by_email(uuid, text, integer) to authenticated;

-- Counsel reads the comments on the granted amendment while the grant is active.
create policy counsel_read_comments on public.bylaw_comments for select to authenticated
  using (exists (
    select 1 from public.counsel_grants g
    where g.bylaw_version_id = bylaw_comments.version_id
      and g.counsel_user_id = auth.uid()
      and g.revoked_at is null
      and g.expires_at > now()
  ));

-- Counsel comments on the granted amendment only, as themselves, while the grant is active.
create policy counsel_comment_insert on public.bylaw_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.counsel_grants g
      where g.bylaw_version_id = bylaw_comments.version_id
        and g.counsel_user_id = auth.uid()
        and g.revoked_at is null
        and g.expires_at > now()
    )
  );
