# Completion plan: every required feature

Scope: the complete platform as requested on 2026-10-19. This includes Ask, billing and credits, resident drafting, AI analytics,
and the bulletin, which are required deliverables. None of them is in launch scope yet. Each one stays disabled in the product
until its approvals, providers and acceptance tests pass.

Definitions used below:
- **Accepted** means the user journey passes in CI **and** on staging, with real services where the feature needs them.
- **Built locally** means code and local tests exist. It does not count as accepted.
- **Gated** means the feature is off in the product by a reviewed flag, with the reason recorded.

Last reconciled: 2026-10-19 against the gap list (`docs/GAP-LIST.md`). Where this plan and the gap list disagree, this plan
lists the feature's status and the gap list keeps its row detail.

## Current status

| # | Feature | Status | Gate |
|---|---|---|---|
| 1 | Notice delivery (send, status, retry) | Built locally (database, server layer). Sending off. Privacy fixed in `20261050000066` | Security decision on sender design |
| 2 | Digests | Not built | Depends on 1 and on a scheduler decision |
| 3 | Council screens and permissions | Permissions in matrix only | Scope decided: in scope |
| 4 | Account conversion (single to multi-building) | Not built | Product confirms PRD §3.3 flow |
| 5 | Municipal address coverage | Not built | Counsel approves corpus |
| 6 | Portfolio analytics | Not built | Product approves metrics |
| 7 | Platform-admin grant, revoke, audit | Database partly built (uncommitted) | Two-operator design; security review |
| 8 | Ask (building manager, resident, portfolio) | Built locally, off (`answers` false) | Counsel corpus approval; eval gate; Groq and Voyage keys; signing and scanner checks |
| 9 | Resident drafting | Code constant off (D5) | Counsel approval of drafting content and rules |
| 10 | Billing and credits | Off (`payments` false) | Payments provider and pricing; test-mode keys; webhook secret |
| 11 | AI analytics | Admin page off | Product approves metrics; scope checks |
| 12 | Bulletin | Off (`bulletin` false) | Product approves scope; RLS tests written |
| 13 | External counsel: grant, read, comment | Built locally; CI green at `6914166` | Staging; security review of email lookup |
| 14 | Counsel invitation by email | Not built | Email provider and sender domain; security review |
| 15 | CBA-BC referral | Not built | Counsel's referral rules |
| 16 | LTO filing and escalation | Built locally (database, UI, E2E) | Product confirms thresholds (14, 60 days); security review of scheduled refresh |
| 17 | Linter enforcement | Advisory only | Counsel and product approve rules |
| 18 | Staging environment and migration reconciliation | Blocked | Operator and project access |

## Owners and what each one waits for

| Owner | Needed for |
|---|---|
| Security reviewer (to be named by you) | 1, 7, 13, 16 (scheduled refresh), and the sender design |
| Counsel | 5, 8 (corpus, evals), 9, 15, 17 |
| Product owner | 4, 6, 11, 12, 16 (thresholds), 17 |
| Payments decision-maker (to be named by you) | 10 |
| Operator (to be named by you) | 18, and staging acceptance for every feature |
| Email provider account holder (to be named by you) | 1, 14 |

## Acceptance tests per feature

Each feature passes when all of these pass in CI **and** on staging:

1. **Success journey** through the real UI, with persisted data read back from the database.
2. **Denial:** a user without the permission is refused in the database and in the server action.
3. **Cross-building and direct-ID:** another building's user cannot read or change the record by id.
4. **Failure:** the provider or service fails, and the user sees a clear state with a retry path.
5. **Loading, empty and error states** on every screen.
6. **Database authorization tests** (pgTAP) for every table and function involved.

Feature-specific tests:

- **1 Notice delivery:** a claim can produce only one outcome; a failed send can be retried up to three times; a batch over 50
  finishes or reports what remains; a success recorded after a failed write does not duplicate a delivery; no raw address
  appears in any response or table a user can read.
- **8 Ask:** counsel-approved content; retrieval never crosses buildings; answers without a source are refused; the eval gate
  must pass before the flag is turned on; a manager's citations match the building.
- **9 Drafting:** drafts require counsel-approved templates; no draft is sent without approval; the legal disclaimer is always
  shown.
- **10 Billing:** real checkout in provider test mode; a webhook with a bad signature is refused; a paid event credits once
  (idempotent); a failed payment does not credit; a refund or dispute is reconciled.
- **11 AI analytics:** approved metrics only; each metric is scoped to the caller's building or portfolio; another firm sees none.
- **12 Bulletin:** RLS on every table; direct-ID reads and writes by another building are refused; pinning and length limits
  enforced in the database.
- **2 Digests:** a digest is sent once per period per resident; only in-force notices appear; an unsent digest is retried.
- **7 Platform admin:** a grant or revoke needs a second operator; every change writes an audit row; the viewer shows changes
  and hides other operators' private data.

## Remaining engineering that does not wait for approval

These can be built and tested locally now, with their gates off:

- Notice delivery: the manager send, status and retry UI (sending off, so the UI shows the disabled state and the status of
  queued records), its E2E journey for unauthorized, cross-building and unapproved cases, and the claim-token state rules.
- Council screens and permission denials (scope decided).
- Account conversion (after the flow is confirmed).
- Portfolio analytics query layer with scope checks (metrics pending approval).
- Platform-admin grant, revoke and audit database tests.
- Ask, drafting and billing code paths, behind their flags, with tests that run with the flags off.

## Migrations

Two notice migrations are local and unapplied to any hosted database: `20261049000065_notice_deliveries` and
`20261050000066_notice_delivery_privacy`. Both apply in order only after staging reconciliation and written approval.
`20261047000063_counsel_access` and `20261048000064_counsel_packet` are also local only.

## What "complete" means here

The platform is complete when every feature in the table above is accepted on staging, or is explicitly excluded by a named
decision-maker. Until then, the status is the one in the table.
