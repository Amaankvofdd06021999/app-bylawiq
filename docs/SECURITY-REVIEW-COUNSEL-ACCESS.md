# Security review request: counsel access by email (account discovery)

**Status: awaiting review. Not approved.** The current slice is live in the code (commit `04f0ee0`, CI green), not on staging.

## What the feature does

A building manager who may adopt bylaws grants counsel access to one amendment by typing counsel's email address. The database
function `grant_counsel_access_by_email` looks the address up in `auth.users` and creates the grant. Code:
`supabase/migrations/20261048000064_counsel_packet.sql`, `features/counsel/actions.ts`.

## The disclosure

The lookup reveals whether an email has a BylawIQ account, to a manager who has the adopt permission on a building:

- If the account exists, the grant is created and the manager sees "Access granted".
- If it does not, the manager sees "needs a BylawIQ account before counsel access can be granted".

A manager can therefore test whether any address is registered. The database does not reveal the account's name, role or
other details. Neither message reveals which building the person belongs to.

## Why it exists

Counsel has no invitation email yet. The email provider and sender domain are not configured (they are blocked on staging).
A pending invitation that counsel accepts after signing in would remove the disclosure. Until invitations exist, the lookup is
the only way to give counsel access to an amendment.

## Mitigations in place

| Mitigation | Where | Effect |
|---|---|---|
| Permission: only a manager who may adopt bylaws can look up an email | `grant_counsel_access_by_email` (`authorize('bylaw.adopt')`) | Residents and portfolio viewers learn nothing |
| Rate limit: 10 grant attempts per 15 minutes per manager | `features/counsel/actions.ts` (`rateLimit('counsel-grant:' + id, 'auth')`) | Limits a bulk address test to a handful per quarter-hour |
| Attempts are logged on failure, without the email address | `logger.error({ context: 'counsel_grant', error })` | The address is not written to logs |
| The UI states the requirement before the attempt | Helper text under the email field | No surprise refusal |
| Grants are visible to managers of that building only | RLS on `counsel_grants` | Other buildings learn nothing about it |

## Residual risk

- A determined manager can still test addresses, up to the rate limit, with the disclosure above.
- The rate limit is per manager account. A manager with several accounts can multiply it.
- Counsel's own email is typed by the manager. A mistyped address reveals whether that typo has an account.

## Proposed condition for approval

Replace the lookup with an invitation: the manager names counsel, the grant is created as **pending**, and counsel accepts it
after signing in. Pending grants give nothing until accepted, and the response to the manager is the same whether or not the
address has an account. This needs the email provider (separate blocker).

## Reviewer decision

| Item | Decision | Reviewer | Date |
|---|---|---|---|
| Accept the disclosure with the mitigations above until invitations exist | ☐ accept ☐ accept with conditions ☐ reject | | |
| Condition: build the pending-invitation flow before counsel is used on real matters | ☐ agree ☐ disagree | | |
| Rate limit of 10 attempts per 15 minutes is adequate | ☐ yes ☐ no (state a limit) | | |
