# Role and flow inventory

Source: `docs/BYLAWIQ-PRD-v3.md` (sections 3 to 14), the release checklist, and the code and tests as they stand at `b696b73`.

## Status vocabulary

| Status | Meaning |
|---|---|
| **Tested on staging** | Passing real-app test on a staging environment with the launch configuration. **None yet: no staging environment exists.** |
| **Tested locally** | Passing real-app E2E or pgTAP test on the local stack. Not staging evidence. |
| **Built** | Code exists and is reachable, with no passing test that covers it. |
| **Off for launch** | Built or partly built, switched off in code (`lib/launch-scope.ts`) or by reviewed decision. Not complete. |
| **Blocked** | Built or designed, but depends on an approval, a provider or a hosted service that is not verified. |
| **Missing** | No code found for the capability. |
| **Deferred by PRD** | The PRD itself defers it (§14). Not a gap in this release, but not complete platform either. |

**Nothing below is complete.** A flow is complete only when it has persisted data, correct role permissions, cross-building
denial tests, failure handling, accessible UI states, and a passing real-app staging test. No row meets all of these.

## Role mapping

The release checklist names five roles. The PRD (§3.5) defines eight. The mapping and the differences:

| Release role | PRD roles | Note |
|---|---|---|
| Building manager | `building_manager`, `council_president`, `council_member` | **Decided 2026-10-17: both council roles are in scope.** `council_president` has full control of one building and can invite council. `council_member` reads and asks, and cannot edit bylaws or send notices. Council roles have a permission matrix entry; no UI flow or E2E test exists yet. |
| Portfolio manager | `portfolio_manager`, `portfolio_assistant` | The assistant role (drafts only) has a matrix entry, no UI test. |
| Firm owner | `org_owner` (PRD "Admin" account type) | **Decided 2026-10-17: firm owner = PRD `org_owner`.** The firm owner sees every building linked to the firm, the roster, the team and the knowledge library. Billing stays off until payments are approved. `org_admin` keeps all buildings and team access without billing. |
| Resident | Owner and resident read-only portal (Phase 4) | Deferred by the PRD. The release resident is the invited resident only. Council members are building-workspace roles, not residents. |
| Platform admin | BylawIQ staff (not a PRD role) | Operator role. |
| *(not in the five)* | `external_counsel` | **Decided 2026-10-17: in scope, built with the legal review workflow.** Time-boxed, read-only access to a review packet. Counsel cannot approve, adopt or send. Missing (see Legal review rows). |

## Building manager

| Flow | PRD | Status | Evidence / gap |
|---|---|---|---|
| Sign in, workspace onboarding | §3 | Tested locally | `onboard` helper, `workspace.spec` |
| Building home dashboard | §4 | Tested locally | `building-manager-dashboard` |
| Upload bylaw to vault: scan, size limit, consent | §11 | Tested locally | `building-documents-ask`: malware reject, no-text PDF, 4 MB limit, retry. Real scanner: Blocked |
| Confirm detected structure, document ready | §6.1–6.2 | Tested locally | `building-documents-ask` |
| Parse bylaw to tree | §6.1 | Tested locally (ingest to review) | Parser quality not verified against real bylaws |
| Browse bylaws and versions | §6.6 | Built | Versioning migration exists; browse UI not in an E2E test |
| Create and edit a structured bylaw | §6.2–6.3 | Missing | Only generic resource CRUD (`features/workspace/actions.ts` `mutateAction`). No structured editor |
| Diff between versions | §6.3 | Missing | No diff module |
| Compliance linter | §6.4 | Missing | No linter module (zero matches) |
| Adoption lifecycle: proposed, voted, adopted; refusals | §6.5 | Tested locally | `building-notices-disputes` (no-majority refusal, failed adoption) |
| LTO filing tracking | §6.5 | Missing | No dedicated module found |
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
| Tested locally | 27 |
| Built, not tested | 11 |
| Off for launch | 10 |
| Blocked | 6 |
| Missing | 21 |
| Deferred by PRD | 1 |

Notes on the counts:

- The upload size limit row is tested locally (the 4 MB limit in the app) and blocked on the deployed limit. It is counted
  once, as blocked.
- Two rows are operational, not role flows: the staging and production environments. They are counted above.
- The PRD defers five product areas in total: lawyer marketplace, owner portal, bylaw benchmarking, PMS connectors, and
  Ontario and Alberta expansion. Only the owner portal appears in the role tables.
- "Tested locally" is not staging evidence. No row has staging evidence.

## What "complete" needs next

Decided 2026-10-17: firm owner = `org_owner`; both council roles in scope; external counsel in scope with legal review.
Product decisions still open are listed in the last table below.

Work is tracked here in dependency order. "Owner" is who must act. "Evidence" is what closes the item. An item closes only
when its evidence exists. "Built" and "tested locally" are not closure.

| # | Work item | Depends on | Owner | Next action | Evidence to close |
|---|---|---|---|---|---|
| 1 | Staging environment, operator, migration-history reconciliation | Operator and project ref | **Operator** (human) | Provide staging project ref and operator access. Then run the history check in `docs/STAGING-ACCEPTANCE.md` §1 | Migration history matches `supabase/migrations`; approval recorded before any apply |
| 2 | Release operations: env names, signing, scanner, invitation email, background services, upload limit, monitoring | 1 | Operator, then Engineering | Run `docs/STAGING-ACCEPTANCE.md` §2–§7 on staging | Each check recorded pass or fail, with names and results only |
| 3 | Legal corpus approval and loading | Counsel approval in writing | **Counsel and product** | Obtain written approval of the corpus and its version | Approval record; corpus loaded from `kb/dist` on staging |
| 4 | Ask: eval gate, real providers, signing, scanner | 2, 3 | Engineering | Run the legal eval against `kb/dist/evals.jsonl`. Keep `answers` false until it passes | Eval report; staging Ask acceptance (`STAGING-ACCEPTANCE.md` §10 criteria) |
| 5 | Structured bylaws: create, edit, versions, browse, diff | Document ingest (done locally) | Engineering | Design schema and role rules from PRD §6.1–6.3. Migration needs approval before apply | Persisted data; permission and cross-building denial tests; staging acceptance |
| 6 | Compliance linter and LTO filing tracking | 5 | Engineering | Linter rules from PRD §6.4; filing from §6.5 | As row 5, plus deterministic fallback tests |
| 7 | Legal review workflow and external counsel | 5 | Engineering, with counsel review of the packet rules | Risk scoring and packet from PRD §7; time-boxed read-only counsel access (decided) | Counsel denied approve, adopt and send; packet persisted; staging acceptance |
| 8 | Notices: templates from the bylaw tree, fine validation, resident delivery | 5 | Engineering | Template and validation rules from PRD §10 | Fine validation refusals tested; delivery to residents verified on staging |
| 9 | Notifications: matching engine, digest | 5, 8 | Engineering | Matching and digest from PRD §8.3–8.4 | Precision tests; digest delivered on staging via email |
| 10 | Council roles UI and tests | Decided (in scope) | Engineering | council_president invites council; council_member read and ask only | Denial tests for council_member on edits and notices; staging acceptance |
| 11 | Account conversion and plus-addressing | Product confirms PRD §3.3 flow | Engineering | Plus-address normalisation; single to multi conversion with re-authentication | Audit record written; denial tests; staging acceptance |
| 12 | Municipal address resolution and coverage | Corpus (row 3) | Engineering, with product on coverage text | Resolve address to jurisdiction; show coverage status (PRD §5) | Coverage shown wherever municipal law applies; staging acceptance |
| 13 | Portfolio analytics | 5 | Engineering | Define metrics with product first (PRD §13) | Metric definitions approved; denial tests; staging acceptance |
| 14 | Platform admin: grant and revoke, flags, audit viewer | 1 | Engineering; operator approval for grants | Review the uncommitted migration; build UI and tests | Two-operator approval test; audit row per change; staging acceptance |
| 15 | Resident explainers and verification | 3 | Engineering | Add tests for the existing component | Real-app test on staging |
| 16 | Monitoring and alerts | 2 | Operator and Engineering | Choose the monitoring service with the operator | Alert fired and received in staging |

### Product decisions still open

| Decision | Why it matters | Blocks |
|---|---|---|
| Counsel approval of the legal corpus and its version | Retrieval and Ask cannot be validated without it | Rows 3, 4, 12 |
| Payments: provider and pricing | Billing and credits stay off without them | Billing and credits rows (off) |
| Ask enablement at launch, or after the full build | Decides whether row 4 gates the first release | Row 4 timing |
| Monitoring service | No service exists in the repository | Row 16 |

Launch readiness for the five-role subset does not make the platform complete. The PRD's Phases 0–10 are the complete
scope. Phase 6 (bylaw editor and linter), Phase 7 (legal review) and Phase 9 (updates) are largely Missing above.
