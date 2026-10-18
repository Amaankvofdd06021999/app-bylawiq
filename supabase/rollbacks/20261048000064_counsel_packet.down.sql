-- Rollback for 20261048000064_counsel_packet.sql: removes the email grant and the counsel comment policies. Existing comments
-- are kept. Grants made through the function remain on record in counsel_grants.

drop policy if exists counsel_comment_insert on public.bylaw_comments;
drop policy if exists counsel_read_comments on public.bylaw_comments;
drop function if exists public.grant_counsel_access_by_email(uuid, text, integer);
