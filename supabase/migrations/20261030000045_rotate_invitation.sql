-- Resend an invitation by issuing a new link. The old link stops working because the token hash is replaced, and the
-- expiry is set again. Only a pending invitation can be rotated (not accepted, not revoked), and only by someone who
-- may invite to that building. Email is not sent here: no email provider is configured, so the admin copies the link.
-- Rollback: drop function public.rotate_invitation(uuid, text, timestamptz).

create or replace function public.rotate_invitation(p_id uuid, p_hash text, p_expires timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare b uuid;
begin
 select building_id into b from public.invitations
  where id = p_id and accepted_at is null and revoked_at is null;
 if not found then raise exception 'invitation_not_pending'; end if;
 if not public.authorize('member.invite', b) then raise exception 'forbidden'; end if;
 update public.invitations set token_hash = p_hash, expires_at = p_expires where id = p_id;
end; $$;

revoke all on function public.rotate_invitation(uuid, text, timestamptz) from public, anon;
grant execute on function public.rotate_invitation(uuid, text, timestamptz) to authenticated;
