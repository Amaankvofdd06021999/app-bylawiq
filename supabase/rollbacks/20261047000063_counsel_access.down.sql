-- Rollback for 20261047000063_counsel_access.sql. Removes counsel access. Removing the table removes every grant on record, so
-- run this only after confirming that no grant is needed for an audit (export counsel_grants first).

drop policy if exists counsel_read_node on public.bylaw_nodes;
drop policy if exists counsel_read_version on public.bylaw_versions;
drop function if exists public.revoke_counsel_access(uuid);
drop function if exists public.grant_counsel_access(uuid, uuid, integer);
drop table if exists public.counsel_grants;
