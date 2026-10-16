# 0001: Migration chain and hosted rollout

Status: accepted for local work. Hosted rollout blocked.

## Decision

- Local development, CI and tests use the working-tree chain (61 files). It resets cleanly from scratch and passes the pgTAP suite.
- The committed HEAD chain (38 files) is not replayable: it fails on a fresh database at `20261007_phase5_infrastructure.sql`. It is kept as history, not as the source for new environments.
- No committed migration file is edited again. New schema changes are forward-only migrations with later version numbers.
- Nothing is applied to the hosted project until an authorized operator provides the unknown below and separately approves a plan.

## The unknown that requires an operator

The exact list of migration versions and names recorded in the hosted project's `supabase_migrations.schema_migrations` table, read-only. The operator should run:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Optionally, if that table has a `statements` column in their CLI version, include a count and hash per row so the recorded SQL can be compared with the files.

Without this, the hosted state cannot be classified as "matches HEAD", "matches the working tree", or "matches neither". Version numbers alone do not decide it.

## Blocked until then

- Any hosted `supabase db push` or manual migration.
- Choosing between a repair migration and a re-baseline for hosted.

## Also required from an operator before deployment

- Authorized Vercel CLI session (`vercel login`) and project link (`vercel link`), so environment variable presence can be checked by name.
