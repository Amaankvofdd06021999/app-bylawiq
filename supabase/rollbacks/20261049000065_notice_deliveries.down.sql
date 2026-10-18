-- Rollback for 20261049000065_notice_deliveries.sql. Removes the delivery record. Export notice_deliveries first if the
-- delivery history is needed for an audit.

drop function if exists public.record_notice_delivery_result(uuid, boolean, text);
drop function if exists public.claim_notice_deliveries(uuid, integer);
drop function if exists public.queue_notice_delivery(uuid);
drop table if exists public.notice_deliveries;
