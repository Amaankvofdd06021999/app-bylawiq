-- Rollback for 20261050000066_notice_delivery_privacy.sql. It restores the column shape and the previous grants. Raw addresses
-- are not recoverable from masked values, so rows queued before the rollback have no raw address.

alter table public.notice_deliveries drop constraint if exists notice_deliveries_masked_shape;
alter table public.notice_deliveries add column recipient_email text;
update public.notice_deliveries set recipient_email = masked_address where recipient_email is null;
alter table public.notice_deliveries alter column recipient_email set not null;
alter table public.notice_deliveries drop column masked_address;
grant select on public.notice_deliveries to authenticated;
