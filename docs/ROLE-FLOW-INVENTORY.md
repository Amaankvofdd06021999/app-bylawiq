# Role and flow inventory

This is the source of truth for role-flow status. Update it in the same commit as any change that moves a status.

**Snapshot:** code at commit `0b3df47` (bylaw version history). Every row except the bylaw rows was last verified at
`b696b73`. The bylaw rows were verified at `0b3df47`. Sources: `docs/BYLAWIQ-PRD-v3.md` (sections 3 to 14), the release
checklist, and the code and tests.

## Status vocabulary

| Status | Meaning |
|---|---|
| **Tested on staging** | Passing real-app test on a staging environment with the launch configuration. **None yet: no staging environment exists.** |
| **Tested locally** | Passing real-app E2E, unit or pgTAP test on the local stack. Not staging evidence. |
| **Built** | Code exists and is reachable, with no passing test that covers it. |
| **Off for launch** | Built or partly built, switched off in code (`lib/launch-scope.ts`) or by reviewed decision. Not complete. |
| **Blocked** | Built or designed, but depends on an approval, a provider or a hosted service that is not verified. |
| **Missing** | No code found for the capability. |
| **Deferred by PRD** | The PRD itself defers it (§14). Not a gap in this release, but not complete platform either. |

**Nothing below is complete.** A flow is complete only when it has persisted data, correct role permissions, cross-building
denial tests, failure handling, accessible UI states, and a passing real-app staging test. No row meets all of these.

## Role mapping

The release checklist names five roles. The PRD (§3.5) defines eight. The mapping, with the decisions of 2026-10-17:

| Release role | PRD roles | Note |
|---|---|---|
| Building manager | `building_manager`, `council_president`, `council_member` | **Decided: both council roles are in scope.** `council_president` has full control of one building and can invite council. `council_member` reads and asks, and cannot edit bylaws or send notices. Council roles have a permission matrix entry; no UI flow or E2E test exists yet. |
| Portfolio manager | `portfolio_manager`, `portfolio_assistant` | The assistant role (drafts only) has a matrix entry, no UI test. |
| Firm owner | `org_owner` (PRD "Admin" account type) | **Decided: firm owner = PRD `org_owner`.** The firm owner sees every building linked to the firm, the roster, the team and the knowledge library. Billing stays off until payments are approved. `org_admin` keeps all buildings and team access without billing. |
| Resident | Owner and resident read-only portal (Phase 4) | Deferred by the PRD. The release resident is the invited resident only. Council members are building-workspace roles, not residents. |
| Platform admin | BylawIQ staff (not a PRD role) | Operator role. |
| *(not in the five)* | `external_counsel` | **Decided: in scope, built with the legal review workflow.** Time-boxed, read-only access to a review packet. Counsel cannot approve, adopt or send. Missing (see Legal review rows). |

## Building manager

| Flow | PRD | Status | Evidence / gap |
|---|---|---|---|
| Sign in, workspace onboarding | §3 | Tested locally | `onboard` helper, `workspace.spec` |
| Building home dashboard | §4 | Tested locally | `building-manager-dashboard` |
| Upload bylaw to vault: scan, size limit, consent | §11 | Tested locally | `building-documents-ask`: malware reject, no-text PDF, 4 MB limit, retry. Real scanner: Blocked |
| Confirm detected structure, document ready | §6.1–6.2 | Tested locally | `building-documents-ask` |
| Parse bylaw to tree | §6.1 | Tested locally (ingest to review) | Parser quality not verified against real bylaws |
| Create and edit a structured bylaw (new section, new version per edit) | §6.2–6.3 | Tested locally | `save_bylaw` (existing); `supabase/tests/bylaw_versions.test.sql` (10 checks: cross-building and resident denial, direct write refused); `bylaw-versions` E2E (create, edit, compare). Editor UI reuses the existing bylaw form |
| Version history, newest first, per bylaw | §6.6 | Tested locally | `bylaw-history.test.tsx` (3); `bylaw-versions` E2E. Empty and too-large states |
| Diff between versions (word level) | §6.3 | Tested locally | `bylaw-diff.test.ts` (8, including rebuild and the too-large fallback); `bylaw-versions` E2E |
| Compliance linter (eight deterministic rules, advisory) | §6.4 | Built (advisory) | `lib/bylaw-linter.ts` (33 unit tests with the mode checks); shown in the bylaw editor as **advisory checks, not legal approval** (`bylaw-lint-panel.test.tsx`, E2E `bylaw-versions`: a blocker is shown and the save still succeeds). **Rules not approved by counsel or product. Blockers not enforced on proposal. No override.** Rules in `docs/LINTER-RULES.md` |
| Adoption lifecycle: proposed, voted, adopted; refusals | §6.5 | Tested locally | `building-notices-disputes` (no-majority refusal, failed adoption) |
| LTO filing tracking | §6.5 | Built (partial) | Database: filing requires a reference and an effective date; a future effective date is refused (`not_yet_effective`); an `unfiled_adoption` notification is raised at adoption and closed on filing. **Gaps: the notification does not escalate over time; the reference is only checked for length; no tests for the filing branch in a staging-grade suite; no UI test** |
| Legal review trigger, review panel | §7.1–7.2 | Missing | No module |
| Risk scoring, review packet | §7.2–7.3 | Missing | No module (zero matches) |
| CBA-BC referral, counsel invitation | §7.2–7.4 | Missing | `external_counsel` appears only in the role table and access hook |
| Notification feed (updates) | §8.1–8.2 | Tested locally | `building-notices-disputes`: adoption creates the update. Feed for other types not tested |
| Notification matching engine | §8.3 | Missing | No module |
| Digest delivery | §8.4 | Missing | No digest module (matches are unrelated) |
| Notice from bylaw tree (templates) | §10 | Missing | No template generator found |
| Fine validation before send | §10 | Missing | No fine validation (zero matches) |
| Notice draft, send to firm review, approve | §10 | Tested locally | `firm-review` |
| Notice send to residents | §10 | Built | Not tested |
| Dispute log | §10 | Tested locally | `building-notices-disputes`: events logged, resolution leaves home |
| Invite resident with unit | §3.4 | Tested locally | `resident-join`. Email delivery: Blocked |
| Verify resident unit | §3.4 | Tested locally | `resident-join` |
| Council member invitation (reduced role) | §3.4 | Built | Permission matrix only; no E2E |
| Single-building binding, one account one building | §3.3 | Tested locally | `tests/roles/account-type-retirement` (unit), pgTAP `personas_authorization` |
| Plus-addressing at signup | §3.3 | Missing | Help text only; no normalisation found |
| Linked accounts and fast switch | §3.3 | Built | Linked-account migrations exist; no E2E |
| Convert single to multi-building account | §3.3 | Missing | No conversion code |
| Invitation-time conversion prompt | §3.3 | Missing | No code |
| Ask BylawIQ, scoped to building | §9 | **Off for launch** | `answers` flag. Server boundary tested locally: `ask-launch-denial` (routes, screen, conversation page), `launch-scope.test.ts` |
| Building bulletin (staff posts, pinning, deletes) | not in PRD §3–§14 | **Off for launch** | `bulletin` flag. Page and four actions refuse; tested locally in `launch-off-surfaces` and `launch-off-actions` |
| Document download from vault | §11 | Built | `documents/[id]/download` route; not tested |
| Municipal address resolution and coverage | §5.2–5.3 | Missing | No address resolution (zero matches) |

## Portfolio manager

| Flow | PRD | Status | Evidence / gap |
|---|---|---|---|
| Portfolio view, switching between linked buildings, counts | §3.1 | Tested locally | `strata-portfolio` |
| Outsider sees no buildings; other firm's building refused by direct id | §3.1 | Tested locally | `strata-portfolio` |
| Assistant role: drafts only, cannot adopt, file or send | §3.5 | Built | Role matrix unit test (`tests/characterization/roles`); no UI test |
| Portfolio analytics | §13 | Missing | No analytics module. The only analytics code is AI analytics, which is off |
| Portfolio Ask | §9 | **Off for launch** | `answers` flag; same server boundary as building Ask (`ask-launch-denial`) |
| Manage buildings across the portfolio (create, link) | §3.1 | Built | Not tested |

## Firm owner

| Flow | PRD | Status | Evidence / gap |
|---|---|---|---|
| Firm onboarding, link buildings by code, roster | §3.1 | Tested locally | `firm-owner-links` |
| Team invitations and membership | §3.5 | Tested locally | `firm-team` |
| Review inbox: request changes, approve | §10 | Tested locally | `firm-review` |
| Firm knowledge library: publish, duplicate refused, text search | §9.3 | Tested locally | `firm-knowledge`. Semantic search: Deferred by PRD scope of firm search |
| Org admin: all buildings, team, org settings | §3.1 | Built | Admin pages exist (`admin/buildings`, `admin/team`); not tested |
| Billing, plans, seats (org owner) | §3.1 | **Off for launch** | `payments` flag. Page not-found and seat action refuses; tested locally in `launch-off-surfaces` and `launch-off-actions` (no seat change, no read) |
| Org-wide audit log | §3.1 | Missing | Audit viewer is deferred (see platform admin) |

## Resident

| Flow | PRD | Status | Evidence / gap |
|---|---|---|---|
| Join with invitation: wrong email, reuse, expiry, revocation, other building | §3.4 | Tested locally | `resident-join` (5 tests) |
| Home: in-force bylaws as alerts, unit status | §8 | Tested locally | `resident-join`. Alerts for other notification types not tested |
| Explainers | §9 | Built | `explainers.tsx` exists; not tested |
| Ask (AI answers) | §9 | **Off for launch** | `answers` flag; tested locally as for building Ask |
| Credits, paywall, purchases | §9 | **Off for launch** | `payments` and `answers` flags. Checkout action refuses with no Stripe call (`launch-off-actions`, tested locally) |
| Drafting (notices, letters) | §10 | **Off for launch** | Code constant (decision D5). Action refuses before any read (`launch-off-actions`, tested locally) |
| Resident verification gate for AI output | doc 11 | **Off for launch** | Behind `answers` |
| Owner and resident read-only portal | §14 | Deferred by PRD | Phase 4 |

## Platform admin

| Flow | PRD | Status | Evidence / gap |
|---|---|---|---|
| MFA enrolment, wrong-code refusal, valid code | D15 | Tested locally | `platform-mfa` |
| MFA step-up, lease, expired-lease recovery | D15 | Tested locally | `platform-mfa-lease`, `platform-mfa-load` |
| Non-admin denied the console | D15 | Tested locally | `platform-mfa` |
| Signing key probe | §12 | Tested locally | pgTAP `signing_key_probe` (database side only) |
| Platform admin reconciliation | D4 | Tested locally | pgTAP `platform_admin_reconciliation` |
| Grant platform admin | D4 | **Missing** | Database function and test are uncommitted (`supabase/migrations/20261044…`). No UI |
| Revoke platform admin | D4 | **Missing** | Same as grant |
| Feature flags | D4 | Built | `set_flag` and admin action exist; no UI test |
| Audit log viewer | §12 | Built | `platform-audit-log.tsx` and `get_audit_logs` exist; no UI test |
| Chat and AI analytics | §13 | **Off for launch** | Admin page not-found (tested locally, `launch-off-surfaces`) |
| Billing | §3.1 | **Off for launch** | Page not-found and webhook 404 (tested locally, `launch-off-surfaces`) |

## Cross-cutting and operations

| Capability | PRD | Status | Evidence / gap |
|---|---|---|---|
| Invitation email: creation | §8 | Tested locally | `invitation_email_status` migration, `invitations.test.ts` (mocked provider) |
| Invitation email: delivery | §8 | **Blocked** | No staging provider configured or verified |
| Malware scanner | §11 | Built, Blocked | Fails closed; local stub tested; real endpoint Blocked |
| Document ingestion (background jobs) | §9 | Tested locally | Inngest dev server; staging Blocked |
| Legal corpus ingestion | §5 | **Blocked** | Requires written approval; `LEGAL_CORPUS_INGEST_ENABLED=false`; `kb/dist` absent |
| Eval gate for the answer model | doc 04 | **Missing** | `kb/dist/evals.jsonl` absent |
| Operational monitoring and alerts | §12 | **Missing** | Only `/api/health` is tested locally |
| Upload size limit | §11 | Tested locally (4 MB, app); Blocked (deployed) | |
| Staging environment | D-release | **Blocked** | No staging project or operator |
| Production environment | D-release | **Blocked** | No operator; no migration approval |

## Counts

Counted from the tables above, 76 rows (the role-mapping table is not counted):

| Status | Rows |
|---|---|
| Tested on staging | **0** |
| Tested locally | 30 |
| Built, not tested | 12 |
| Off for launch | 10 |
| Blocked | 6 |
| Missing | 17 |
| Deferred by PRD | 1 |

Notes on the counts:

- The upload size limit row is tested locally (the 4 MB limit in the app) and blocked on the deployed limit. It is counted
  once, as blocked.
- Two rows are operational, not role flows: the staging and production environments. They are counted above.
- The PRD defers five product areas in total: lawyer marketplace, owner portal, bylaw benchmarking, PMS connectors, and
  Ontario and Alberta expansion. Only the owner portal appears in the role tables.
- "Tested locally" is not staging evidence. No row has staging evidence.

## Tracker

**CI gate status:** red at `c864765` on `platform-mfa-load` (E2E). Two product-level causes are confirmed locally: (a) the
sign-in server action sometimes never returns (busy button, no error, no server log); (b) concurrent enrolment verification
took 16.6 s under load, past the 15 s UI deadline. The spec now signs admins in one at a time. Both causes remain open.

Dependency order. Each row has one owner, one target commit, and one acceptance test. An item closes only when its
acceptance test passes on **staging** with the launch configuration. "Built" and "tested locally" are not closure.

"Target commit" is the commit that delivers the item. "Local" means the item is done on the local stack, with its
acceptance test passing there. A row says "pending" until its commit exists.

| # | Work item | Owner | Depends on | Target commit | Acceptance test | Status | Next action |
|---|---|---|---|---|---|---|---|
| 1 | Staging environment and operator; migration-history reconciliation | **Operator** (human) | Staging project ref and operator access | pending | `docs/STAGING-ACCEPTANCE.md` §1: hosted history matches `supabase/migrations`; any apply has written approval | Blocked | Provide the staging project ref and operator access |
| 2 | Release operations: env names, signing, scanner, invitation email, background services, upload limit, monitoring | Operator, then Engineering | 1 | pending | `docs/STAGING-ACCEPTANCE.md` §2–§7, each check recorded pass or fail on staging | Blocked | Run the runbook once item 1 is done |
| 3 | Legal corpus approval and loading | **Counsel and product** | Written approval of corpus and version | pending | Approval record; corpus loaded from `kb/dist` on staging | Blocked | Obtain written approval |
| 4 | Ask: legal eval, real providers, signing, scanner | Engineering | 2, 3 | pending | Eval report passes; staging Ask acceptance (`STAGING-ACCEPTANCE.md` §10); `answers` flipped only by reviewed change | Off for launch | Keep `answers` false until the eval passes |
| 5 | Structured bylaws: create, edit, version history, word diff | Engineering | Document ingest (done locally) | `0b3df47` (local) | `supabase/tests/bylaw_versions.test.sql` (10/10); `bylaw-diff.test.ts` (8/8); `bylaw-history.test.tsx` (3/3); `bylaw-versions` E2E (4 passed on desktop and mobile). Rollback: revert `0b3df47`, no migration involved | Tested locally. **Staging acceptance pending** | Run the same acceptance test on staging after item 2. Add council_member denial on bylaw edits when item 10 lands |
| 6 | Compliance linter and LTO filing tracking | Engineering; **counsel and product** approve the rules | 5 | pending | Linter: advisory panel in the editor (done locally). Enforcement only after approval: blockers refused by `transition_bylaw` (pgTAP, local), override recorded with a typed reason (pgTAP), cross-building denial on override (pgTAP), staging. LTO: validated filing reference (unit and pgTAP), status persisted (pgTAP), unfiled notice escalates on a stated schedule (tested), staging | Built (advisory linter); LTO partial | Counsel and product approve or change `LINTER-RULES.md` and the schedule. Then enforcement migration (needs approval). LTO validation and escalation next |
| 7 | Legal review workflow and time-limited counsel access | Engineering, with counsel review of packet rules | 5 | pending | Counsel denied approve, adopt and send (pgTAP); packet persisted; access expires (pgTAP); staging | Missing | Design packet and counsel grant schema, subject to migration approval |
| 8 | Notices: templates from the bylaw tree, fine validation, resident delivery | Engineering | 5 | pending | Fine validation refusals (unit); delivery to a resident verified on staging | Missing | Specify templates from PRD §10 |
| 9 | Notifications: matching engine and digest | Engineering | 5, 8 | pending | Precision tests on matching; digest delivered on staging by email | Missing | Specify matching rules from PRD §8.3 |
| 10 | Council roles: screens and permissions | Engineering | Decided (in scope) | pending | council_president invites council; council_member denied edits and notices (pgTAP and E2E); staging | Built (matrix only) | Add council screens and denial tests |
| 11 | Account conversion and plus-addressing | Engineering; product confirms PRD §3.3 flow | Re-authentication design | pending | Plus-address normalisation (unit); conversion writes an audit row (pgTAP); denial tests; staging | Missing | Specify conversion flow with product |
| 12 | Municipal address resolution and coverage | Engineering; product on coverage text | 3 (corpus) | pending | Coverage shown wherever municipal law applies; staging | Missing | Specify resolution with product |
| 13 | Portfolio analytics | Engineering; product defines metrics | 5 | pending | Metric definitions approved; denial tests; staging | Missing | Product defines metrics (PRD §13) |
| 14 | Platform admin: grant, revoke, flags, audit viewer | Engineering; operator for grants | 1 | pending | Two-operator approval test; audit row per change; UI E2E; staging | Missing (grant, revoke); Built (flags, audit) | Review the uncommitted grant migration; add UI tests |
| 15 | Resident explainers and verification | Engineering | 3 | pending | Real-app test of explainers; verification tests | Built | Add tests |
| 16 | Monitoring and alerts | Operator and Engineering | 2 | pending | Alert fired and received on staging | Missing | Choose service with operator |

### Product decisions still open

| Decision | Why it matters | Blocks |
|---|---|---|
| Counsel approval of the legal corpus and its version | Retrieval and Ask cannot be validated without it | Rows 3, 4, 12 |
| Payments: provider and pricing | Billing and credits stay off without them | Billing and credits rows (off) |
| Ask enablement at launch, or after the full build | Decides whether row 4 gates the first release | Row 4 timing |
| Monitoring service | No service exists in the repository | Row 16 |

Launch readiness for the five-role subset does not make the platform complete. The PRD's Phases 0–10 are the complete
scope. Phase 6 (linter and LTO), Phase 7 (legal review) and Phase 9 (updates) are largely Missing above.
