# LTO filing escalation: decision and behavior

## Decision

Adopted amendments that have no LTO filing record escalate on this schedule, counted from the day the bylaw was adopted:

| Days unfiled | Severity | Home and Updates show |
|---|---|---|
| 0 to 13 | info | "Unread update" |
| 14 to 59 | warning | "Unread update · needs action" (badge: Needs action) |
| 60 or more | critical | "Unread update · overdue: record the LTO filing" (badge: Overdue) |

**Source of the decision:** the option the product owner chose on 2026-10-17, "Proposed: 14 days info, 30 days warning, 60 days
critical", and that option's own description, "becomes a warning after 14 days unfiled, and critical after 60 days". The label
said "30 days warning", which contradicts the description. The description is the fuller statement, so it is the one implemented.
**The 30-day label is discarded. Product owner to confirm in writing; counsel to confirm the thresholds are right.**

Where it lives, and must match: `lib/lto-filing.ts` (`UNFILED_WARNING_DAYS = 14`, `UNFILED_CRITICAL_DAYS = 60`) and
`supabase/migrations/20261046000062_lto_filing_tracking.sql` (`unfiled_notice_severity`). Both are checked against the same
boundary values: `tests/lto-filing.test.ts` (TypeScript) and `supabase/tests/lto_filing.test.sql` (database).

## Two sources of severity, and which behavior uses which

The notice row has a stored `severity` column. The screens calculate severity from the notice's date. They can disagree.

| Behavior | Reads | Correct today? |
|---|---|---|
| Home: unfiled-filing update text ("needs action", "overdue") | Calculated from `created_at` (`unfiledSeverity`) | Yes. Shown on every read |
| Updates screen: badge | Calculated from `created_at` for filing notices (`resources.tsx`) | Yes, since commit with the Updates fix. Other notice types still use the stored value |
| Other update types on the home (not filing notices) | Stored `severity` | Yes. Those types do not escalate |
| `refresh_unfiled_notice_severity` (database) | Writes stored `severity` for open filing notices | Only when run. **Not scheduled: the job is held (see the security review). Until it runs, the stored value stays `info`** |
| Any future report, digest or export | Must not use the stored value for filing notices | Use `unfiledSeverity`, or wait until the scheduled refresh is approved and running |

**Rule for now:** nothing may treat the stored `severity` of a filing notice as current. The screens calculate it. The stored
value becomes meaningful only when the refresh job runs.

## What the database enforces

- A filing needs a reference that passes `lto_reference_valid` (after trimming) and an effective date.
- Recording the filing closes the notice (`state = 'actioned'`). Escalation ends at filing, as the PRD requires.
- The refresh function is executable by the service role only. It changes only open filing notices, and only their severity.

## Open items

1. Product owner: confirm 14 and 60 days in writing (the 30-day label is withdrawn).
2. Security reviewer: approve or reject the scheduled refresh (`docs/SECURITY-REVIEW-LTO-REFRESH.md`).
3. Counsel: confirm the thresholds.
4. Staging: run the escalation on staging with real time, not backdated rows (acceptance for this flow).
