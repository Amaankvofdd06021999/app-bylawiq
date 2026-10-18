# Delivery plan and staging unblock request

Source of truth for flow status: `docs/ROLE-FLOW-INVENTORY.md` (tracker) and `docs/GAP-LIST.md`. This file is the ranked plan
and the request for the staging environment. Completion means a flow passes its acceptance on **staging**. Local tests are
evidence of a step, not completion.

Last updated: 2026-10-19. Current commit with green CI: `da46925` (run `39158642846`: app, database, knowledge-base).

## 1. Flow status by role (reconciled against PRD v3)

Categories: **Deployed** (working in deployment): none. **Local only** (passes locally, not on staging): counted below.
**Partly built** (code exists, no passing test). **Missing**. **Blocked** (needs an approval or service). **Gated** (off on purpose).

Counted from `docs/GAP-LIST.md` (84 rows), by script, on 2026-10-19. The gap list groups counsel rows under building manager; council
has no separate section yet.

| Role (gap-list section) | Local only | Partly built | Missing | Blocked | Gated | Deferred | Decision pending | CI only | Deployed |
|---|---|---|---|---|---|---|---|---|---|
| Building manager (incl. counsel and council rows) | 17 | 6 | 13 | 2 | 2 | 0 | 1 | 0 | 0 |
| Portfolio manager | 2 | 2 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Firm owner | 4 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Resident | 2 | 1 | 0 | 0 | 4 | 1 | 0 | 0 | 0 |
| Platform admin | 5 | 2 | 2 | 0 | 2 | 0 | 0 | 0 | 0 |
| Cross-cutting and operations | 2 | 0 | 2 | 6 | 0 | 0 | 0 | 1 | 0 |
| **Total** | **32** | **12** | **19** | **8** | **10** | **1** | **1** | **1** | **0** |

"Local only" means it passes on the local stack. None of the 84 rows is deployed. Counts cover the rows the gap list records; a
row that spans several sub-flows is counted once.

**Reconciliation notes against the PRD:**
- PRD §3.5 defines eight roles. The release names five. Council roles and external counsel are in scope by decision, so they are
  rows here. Assistant (`portfolio_assistant`) and owner portal (Phase 4) are included as partly built and deferred respectively.
- "Bulletin" and "payments" are not in the PRD sections reviewed. They are gated and stay gated.
- "Corpus" and "legal eval" depend on counsel approval, which has not been given.

## 2. Ranked delivery plan

Each slice is a complete journey for one role: UI, persistence, authorization, failure states, and the success, denial and
cross-building tests. A slice is done when it passes on staging.

| Rank | Slice (role) | Owner | Depends on | Acceptance criteria (all on staging) |
|---|---|---|---|---|
| 0 | Staging project, operator, read-only migration reconciliation | Requester (you) | Access to Supabase and Vercel | See §3. Reconciliation report with no unexplained gaps |
| 1 | Counsel review: access grant UI, review packet, comments, referral (external counsel) | Engineering | Rank 0 (to run on staging). Counsel review of the packet content | Manager grants 7 days; counsel signs in, reads the amendment and packet, comments; counsel cannot approve, adopt or grant; another building's manager and expired grants refused; revocation works. pgTAP and E2E attached |
| 2 | Resident notice delivery and digests (resident, building manager) | Engineering | Rank 0; email provider (requester) | Notice sent to a verified resident address; digest sent on schedule; resident sees only own building; email outage shows an error and retries |
| 3 | Council screens and denial tests (council president, council member) | Engineering | Decision made: both roles in scope | President invites council and manages the building; member reads and asks, cannot edit bylaws, send notices, or invite. Denials tested by direct ID |
| 4 | Account conversion (single to multi-building) | Engineering; product confirms the flow | Product sign-off of PRD §3.3 flow; re-authentication design | Plus-addressing normalised; conversion requires re-authentication and writes an audit row; the other account keeps its building; denials tested |
| 5 | Municipal address coverage (building manager, resident) | Engineering; counsel for coverage text | Corpus approval (blocked) | Address resolves to a jurisdiction; coverage status shown wherever municipal law applies. **Blocked until counsel approves the corpus** |
| 6 | Portfolio analytics (portfolio manager) | Engineering; product defines metrics | Metric definitions approved | Metrics match database counts; other firm's portfolio refused by direct ID |
| 7 | Platform admin: grant and revoke UI, audit viewer, flags | Engineering; operator for grants | Two-operator approval design; security review | Grant and revoke need two operators; every change writes an audit row; the viewer shows it; ordinary users refused |
| 8 | Linter enforcement and LTO escalation to staging | Counsel and product; Engineering | Written approval of rules and thresholds | Blockers refuse proposal on staging; override recorded with reason; escalation on the stored date (not backdated) |
| 9 | Notification matching engine | Engineering; product precision target | Rank 2 | Precision measured on a labelled sample; denials tested |

Items gated and not scheduled to launch: Ask (all roles), billing and credits, drafting, AI analytics, bulletin.

## 3. Staging unblock request

What is missing, who can provide it, and what it unlocks.

| Item | Needed for | Who provides it | Earliest date (if provided by the date shown) |
|---|---|---|---|
| Supabase staging project reference, with the owner's invite for the operator | Migration reconciliation, every staging acceptance | Account owner (requester) | Same day as request; reconciliation the next working day |
| Vercel staging project name and team slug, with access for the operator | Deployment of each slice; environment check | Account owner (requester) | Same day; first deploy the next working day |
| Named operator with Supabase read-only access and Vercel deploy access | Running reconciliation and deployments; recording evidence | Requester names a person | Same day as named |
| Staging environment values: `NEXT_PUBLIC_SUPABASE_URL`, anon key, server keys, signing secret matching the database | App runs on staging | Operator, set in Vercel from the Supabase dashboard (values never shared in chat) | Day after the project exists |
| Email sender domain and provider key (Resend), with a staging allowlist | Rank 2; invitation delivery | Requester or domain owner | Dependent on DNS verification; typically 1 to 2 working days |
| Inngest keys and the cron on staging | Background ingestion; Rank 2 digests | Requester (Inngest account) | Same day as the account |
| Malware scanner endpoint and token | Document upload on staging | Requester chooses a provider | Dependent on procurement |
| Written approval of the LTO thresholds (14, 60 days) | Escalation acceptance | Product owner | On request |
| Counsel approval of the corpus and the linter rules | Ranks 5, 8; Ask | Counsel | Not scheduled; not a date we can commit to |
| Security reviewer for `docs/SECURITY-REVIEW-LTO-REFRESH.md` | Scheduled refresh | Security reviewer (requester assigns) | On request |

**Earliest staging-usable date:** if the Supabase project, Vercel project and a named operator are provided today, the first
read-only reconciliation can run the next working day, and the first slice (Rank 1) can be deployed to staging the working day
after the environment values are set. Email, scanner and Inngest are needed before their own slices are accepted, not before
Rank 1. I cannot promise a date until the project and operator exist.

## 4. Tracker and CI consistency

- CI: green on `da46925` (run `39158642846`). The app job's E2E was red on `7dc2e36` and `79b1071`; the failing test was
  identified from check-run annotations and fixed in `f43ffcb` (green).
- Tracker: the CI line now names the current green run. Older red entries are kept as history, marked as such.
- Local tests are evidence of a step, not completion. No flow in the tracker is complete until its staging acceptance is recorded.

## 5. Daily report (format)

- Flows accepted on staging: **0**
- Flows newly completed: **0**
- Current blocker and owner: staging project, Vercel project and named operator. Owner: requester.
- Next acceptance date: not set until the blocker is cleared.
