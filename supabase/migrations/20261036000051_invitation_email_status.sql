-- Decision D10: an invitation records what happened to its email, so the admin sees delivery status and the link is always
-- the fallback. The app sends the email (lib/email/invitations.ts) and then records the outcome through
-- record_invitation_email, which checks the caller can invite to that building.
--
-- No token or secret is stored here. Email errors are short provider messages, truncated to 200 characters.
-- Rollback: drop function public.record_invitation_email(uuid, text, text) and the three email_* columns.

alter table public.invitations
  add column if not exists email_status text not null default 'not_configured'
    check (email_status in ('not_configured','sent','failed','skipped_staging')),
  add column if not exists email_error text,
  add column if not exists email_updated_at timestamptz;

create or replace function public.record_invitation_email(p_invitation uuid, p_status text, p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare b uuid;
begin
  select building_id into b from public.invitations where id = p_invitation;
  if not found or not public.authorize('member.invite', b) then raise exception 'forbidden'; end if;
  if p_status not in ('sent','failed','not_configured','skipped_staging') then raise exception 'invalid_input'; end if;
  update public.invitations
     set email_status = p_status, email_error = left(p_error, 200), email_updated_at = now()
   where id = p_invitation;
end; $$;

revoke all on function public.record_invitation_email(uuid, text, text) from public, anon;
grant execute on function public.record_invitation_email(uuid, text, text) to authenticated;
