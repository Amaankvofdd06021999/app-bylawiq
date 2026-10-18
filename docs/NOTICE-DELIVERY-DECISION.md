# Decision needed: how notice emails are sent without exposing resident addresses

**Status: blocked. No UI is built. Nothing is deployed.**

## The defect in commit `006e3d2` (local only, not deployed)

- `claim_notice_deliveries` returns `email_address` to its caller. It is client-callable: any signed-in user who may adopt bylaws
  can call it through the database API with the browser's key.
- `notice_deliveries.recipient_email` is readable by those same managers through row-level security, because the select policy
  covers the whole row.

Result: a manager can read raw email addresses of every resident of their building, outside the UI. The requirement was that the
UI shows masked addresses and that raw addresses are not obtainable through a client-callable call. This does not meet it.

## Why it cannot be fixed by hiding columns alone

The server must know the address to send the email. Any path that gives the server the address through the user's session also
gives it to the user's session, because the user can call the same path directly. A column privilege or a hidden RPC only
moves the exposure. The address has to be resolved by something that is not the user's session.

## Options

| Option | How it works | Exposure | Cost and risk |
|---|---|---|---|
| **A. Server-only sender with the service role** (recommended) | A single server module reads the address for one delivery, from `auth.users`, using the service-role client, and sends. The browser never sees it. The module is added to the lint policy's allowlist, as `inngest/ingest.ts` is | None to users. The service key is used only by this module | Needs a reviewer's approval of the lint exception, the same kind of exception the scheduled job needed. The module takes no user input for the address, only a delivery id it checked |
| **B. Separate sender service** | A small service outside the app holds the key and sends from a queue | None | Another deployable and another key to operate. Slower to build |

**Recommendation: Option A**, with the module limited to: take a delivery id that the database has already claimed for the caller,
resolve that one address, send, and return only the outcome.

## What changes once approved (Option A)

1. Stop storing addresses in our tables. Store only the masked address, the user id, and the delivery status.
2. The claim function returns delivery ids and an attempt token. Outcomes can be recorded only with the token of a claimed attempt.
   A claim that is not recorded within 15 minutes becomes claimable again, so a failed record never leaves a delivery stuck.
3. Batches over 50: the action keeps claiming until none are due, up to 10 rounds (500 recipients), then reports how many remain
   queued and offers to continue. Nothing is left queued silently.
4. If a send succeeds but recording fails, the claim expires and the attempt is retried. The resident may receive the email twice.
   This at-least-once behavior is accepted and stated in the UI.
5. Rebuild the tests for these rules (pgTAP and unit), then build the UI and the E2E journey.

## Reviewer decision

| Item | Decision | Reviewer | Date |
|---|---|---|---|
| Approve Option A (service-role sender module, lint exception) | ☐ approve ☐ approve with conditions ☐ choose Option B ☐ reject | | |
| Accept at-least-once delivery (a resident may receive a duplicate after a recording failure) | ☐ accept ☐ reject | | |
| Notice emails must be sent only to residents of the same building (checked in the database, not the UI) | ☐ agree | | |

## Until this is decided

- The send action stays off. No UI shows a send button.
- The committed backend remains local. It should not be deployed.
- The earlier pgTAP and unit results cover the old design. They are evidence about that design only.
