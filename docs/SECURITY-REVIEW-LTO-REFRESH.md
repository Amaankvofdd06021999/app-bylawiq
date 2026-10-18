# Security review request: scheduled refresh of unfiled-filing severity

**Status: awaiting review. Not approved. The job is not registered and must not be registered until a reviewer signs below.**

## What is requested

Register one scheduled job, `refresh-unfiled-notices`, that runs daily at 06:00 UTC. It calls the database function
`refresh_unfiled_notice_severity()` and does nothing else.

The job needs an exception to the project's lint policy. The policy restricts the service-role client
(`@/lib/supabase/admin`) to a listed set of files (`inngest/ingest.ts`, `features/members/invite.ts`,
`lib/health-probe.ts`). The job would be a fourth file on that list.

## The code

- Database: `supabase/migrations/20261046000062_lto_filing_tracking.sql`, function `refresh_unfiled_notice_severity()`.
  It is `security definer`, with `search_path` set to empty. It runs `update public.notifications` for rows where
  `type = 'unfiled_adoption'`, `state in ('new','viewed')`, and the severity differs from the schedule. It returns a count.
  `revoke all ... from public, anon, authenticated` and `grant execute ... to service_role` only.
- Job (held, not in the repo): `inngest/refresh-unfiled.ts`. It takes no request input and no building id. The function
  takes no arguments. It calls `checkDb` on the error, so the raw database text does not reach the job's error.
- Unit tests for the job: `tests/refresh-unfiled.test.ts` (3 checks). Database tests for the function: `supabase/tests/lto_filing.test.sql`
  (refresh changes an open notice; leaves a closed one alone; an authenticated user cannot run it; another building cannot read).

## Why the service-role client, and why it is acceptable

The function must update notices in every building, on a schedule, with no user present. No user session can do that under
row-level security, which is the intended design. The alternatives considered:

1. **Run the schedule inside the database** (`pg_cron`, calling the function as the database owner). This would not need the
   service-role key in the app. It is the preferred option if the hosted project provides the extension. Its availability on the
   staging project is **unknown and must be checked by the operator**.
2. **Keep the Inngest job with the service-role client, and add the exception.** Acceptable if the reviewer agrees the scope is
   limited, as set out below.
3. **Do not schedule it.** Then stored severity never changes, and the screens calculate it instead (see `docs/LTO-ESCALATION.md`).

## Threat analysis

| Threat | Mitigation | Residual risk |
|---|---|---|
| Use of the service-role key to read or change other tables | The job calls one function only. The function writes only `notifications.severity` on filing rows | Low: the key is in the job's environment, and any code that gets it can do more. Limit: only the listed file may import the client |
| A user triggering the job | The job has no HTTP trigger of its own and takes no input. Inngest runs it on the cron. Registration is in the Inngest route, which is protected by Inngest's signing key | Low. Requires the Inngest signing key |
| Changing notices a user can see | Changes severity only. Does not change `state`, `title` or `body` | Low: severity drives display only |
| Error messages leaking data | Errors go through `checkDb`. The job logs nothing about building content | Low |
| Runaway writes | The function is one `update` bounded by the filing rows. Expected rows: one per unfiled adoption | Low |
| Wrong schedule | Thresholds are in one function and tested. Changing them is a reviewed migration | Medium until counsel confirms the thresholds |
| The key stays in place after removal | Removing the job removes the import. The key rotates on the usual schedule | Operator step |

## Operational requirements before registration

- Operator: confirm the Inngest signing key and event key are set on staging and production, and the cron is enabled for the project.
- Operator: confirm whether `pg_cron` is available. If it is, option 1 is preferred and this request should be withdrawn.
- Staging: run the job on staging, observe one change, and confirm nothing else changed (acceptance for this flow).

## Rollback

Remove the job from the Inngest route, and remove the file from the repo. The database function may stay: it does nothing unless called.

## Reviewer decision

| Item | Decision | Reviewer | Date |
|---|---|---|---|
| Approve the lint exception for `inngest/refresh-unfiled.ts` | ☐ approve ☐ approve with conditions ☐ reject | | |
| Prefer `pg_cron` instead | ☐ yes ☐ no | | |
| Conditions (if any) | | | |
