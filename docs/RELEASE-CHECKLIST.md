# Release checklist: five roles

Derived from `docs/LAUNCH-SECURITY-MATRIX.md`. Each row gives the route or database action, the authorization and RLS
proof (pgTAP in `supabase/tests`), the end-to-end proof (`tests/e2e`), and one status:

- **Working**: built, and proven by the committed tests on the clean checkout of the final candidate.
- **Disabled**: built or partly built, switched off for launch by decision. Not claimed.
- **Deferred**: not built, or built without tests. Not claimed for launch.
- **Blocked**: cannot be verified without production evidence from an authorized operator. See the production section.

A role is not complete while its deferred or blocked rows remain. Nothing in the Disabled or Deferred rows is evidence
for launch.

**Release status: not release-ready.** Verified so far: the committed candidate passes CI on GitHub (see the final report)
and the local launch-configuration E2E suite passes. Not verified: staging acceptance (no staging environment was available),
hosted migration history and Vercel configuration (no authorized operator), email delivery, the scanner, the Groq and Voyage
keys, the legal corpus load, and the eval gate. The building-manager Ask row is blocked for launch (see its requirements).

## 1. Building manager

| Flow | Route or action | Authorization and RLS proof | E2E proof | Status |
|---|---|---|---|---|
| Building home from database | `/b/<id>/home` | pgTAP `isolation`, `personas_authorization` | `building-manager-dashboard` (other manager refused by direct id) | Working |
| Upload and confirm documents | document upload actions | pgTAP `building_documents_slice` | `building-documents-ask` (retry refused to other building) | Working |
| Ask, scoped to this building | Ask route (`chat.use`, building-scoped) | pgTAP `building_documents_slice` (scoping). Answer quality not tested | `building-documents-ask` (stub model, see requirements below) | **Blocked for launch.** Enabled by permission with no feature flag. Not release-ready until the requirements below are met and the eval gate passes |
| Notices and updates | `/b/<id>/notices` | pgTAP `notices_disputes_authorization` (read, dismiss, reason required, resident and other building refused) | `building-notices-disputes` | Working |
| Bylaw draft, review, vote, adopt | `transition_bylaw` (`bylaw.adopt`) | pgTAP `notices_disputes_authorization` (resident and other building refused) | `building-notices-disputes` (adoption creates the update; no-majority refusal shows reason) | Working |
| Disputes: open and log events | `log_dispute_event` (`dispute.create`, `dispute.update`) | pgTAP `notices_disputes_authorization` (unknown stage refused) | `building-notices-disputes` (short summary refused; resolution leaves home) | Working |
| Send notice to firm for review | `request_firm_review` | pgTAP `firm_review` | `firm-review` (send, request changes, approve) | Working |
| Create resident invitation | `create_resident_invitation` (`member.invite`) | pgTAP `resident_join` (18) | `resident-join` (invite with unit, verify, denials) | **Working: creation is tested.** |
| Deliver invitation email | invitation email sender (Resend) | `tests/email/invitations.test.ts` covers outcomes with a mocked provider only | none | **Blocked: delivery is not verified.** No provider, sender or staging allowlist is confirmed |
| Verify resident units | `verify_resident_unit` | pgTAP `resident_join` | `resident-join` | Working |
| Drafting help | drafting actions | Demo tests assert the blocked state (D5) | Not an E2E test | Disabled |
| Resident-facing AI answers | resident Ask | Not claimed | Not claimed | Disabled |

### Building-manager Ask: what it needs before launch

Enabled state today: **built and enabled by permission (`chat.use`), with no feature flag.** The resident flag `residentAi`
is off, and that does not affect managers. Launch position: **not enabled for launch** until every requirement below is met
and the eval gate passes. AGENTS.md §6 applies: legal correctness beats shipping speed.

| Requirement | Where it is used | State |
|---|---|---|
| Groq answer model: `GROQ_API_KEY`, `AI_ANSWER_MODEL` (default `openai/gpt-oss-120b`), `AI_FAST_MODEL` | answer and query expansion (`lib/ai/models.ts`, `features/chat/*`) | Blocked: no production key confirmed. Without the key, Ask returns "answer service not connected" (503) |
| Voyage embeddings: `VOYAGE_API_KEY` | retrieval embeddings (`lib/ai/embeddings.ts`) | Blocked: not confirmed |
| Legal corpus loaded into `legal_sources` from `kb/dist` | `hybrid_search_legal` | Blocked: `kb/dist` is not in this checkout. The knowledge-base CI job builds it, but nothing loads it into the hosted database |
| Eval gate (AGENTS.md §1, doc 04) against `kb/dist/evals.jsonl` | release gate for the answer model | **Not run.** The evals file is absent |
| Signing secret: `SERVER_SIGNING_SECRET` matches the database | verified messages (`features/chat/stream.ts` signs each verified answer) | Blocked: operator check required |
| Document scanner: `FILE_SCAN_URL`, `FILE_SCAN_TOKEN` | upload and ingestion fail closed without it (`features/documents/file-scan.ts`) | Blocked: no real scanner confirmed |
| Ingestion queue: Inngest event and signing keys | indexing of uploaded bylaws | Blocked: not confirmed |
| Stub model is refused on Vercel | `AI_PROVIDER=local-stub` throws on Vercel (`lib/ai/provider-mode.ts`) | Working in code |

The E2E test `building-documents-ask` proves the control flow: retrieval scoping, citation checks, the effective date, and
refusal with no source. It runs on the **local stub model**, so it does not prove answer quality. The stub is never
production output.

## 2. Portfolio manager

| Flow | Route or action | Authorization and RLS proof | E2E proof | Status |
|---|---|---|---|---|
| Portfolio of linked buildings (counts from database) | portfolio route | pgTAP `personas_authorization` | `strata-portfolio` (switching; other firm's building refused by direct id; outsider sees none) | Working |
| Ask across the portfolio | portfolio Ask | Not claimed | Not claimed | Deferred |
| Portfolio analytics | analytics | Not claimed | Not claimed | Deferred |

## 3. Firm owner

| Flow | Route or action | Authorization and RLS proof | E2E proof | Status |
|---|---|---|---|---|
| Onboarding, linking buildings by code, roster | onboarding and link actions | pgTAP `personas_authorization` | `firm-owner-links` (other firm sees neither roster nor buildings; direct id refused) | Working |
| Team invitations and membership | team actions | pgTAP `firm_team` (13) | `firm-team` | Working |
| Review inbox and decisions | `decide_firm_review` | pgTAP `firm_review` (17) | `firm-review` | Working |
| Firm knowledge library, publish | `publish_firm_document` | pgTAP `firm_knowledge` (13) | `firm-knowledge` (publish, duplicate refused, other firm sees none) | Working. Search is text search, not semantic |
| Semantic firm search | none | Not claimed | Not claimed | Deferred |

## 4. Resident

| Flow | Route or action | Authorization and RLS proof | E2E proof | Status |
|---|---|---|---|---|
| Join with invitation: wrong email, reuse, expiry, revocation, other building | `accept_invitation` | pgTAP `resident_join` | `resident-join` (5 tests) | Working |
| Home: in-force bylaws as alerts; unit status | `/b/<id>/home` | pgTAP `resident_join` (residents read in-force only, not drafts; other building reads none) | `resident-join` | Working |
| Ask (AI answers) | resident Ask | Not claimed | Excluded (`docs/TEST-EXCLUSIONS.md`) | Disabled (D5, D12) |
| Free questions and credits | credits | Not claimed | Excluded | Disabled |
| Paywall and purchase | paywall | Not claimed | Demo only, not evidence | Disabled |
| Drafting | drafting | Not claimed | Demo only, not evidence | Disabled |

## 5. Platform admin

| Flow | Route or action | Authorization and RLS proof | E2E proof | Status |
|---|---|---|---|---|
| MFA enrolment | `startTotpEnrollmentAction` (`/admin/platform/mfa`) | Admin check: pgTAP `platform_admin_reconciliation`. No pgTAP test covers enrolment itself | `platform-mfa` (enrol, wrong-code refusal, valid code) | Working |
| Step-up to the console | `verifyTotpAction` (`/admin/platform`) | pgTAP `mfa_verification_lease` (8) | `platform-mfa`, `platform-mfa-load` | Working |
| Verification lease (one at a time; expired lease recovers) | `acquire_mfa_verification`, `release_mfa_verification` | pgTAP `mfa_verification_lease` | `platform-mfa-lease` | Working |
| Non-admin denial of the console | admin route guard | pgTAP `platform_admin_reconciliation` | `platform-mfa` (ordinary user sent away) | Working |
| Signing-key probe | signing-key check | pgTAP `signing_key_probe` | none | Working in the database. Production key match is **Blocked** |
| Grant and revoke platform admin | `grant_platform_admin`, `revoke_platform_admin` | Not in HEAD. The migration and test are uncommitted | none | Deferred (no UI, uncommitted) |
| Feature flags | `set_flag` | none | none | Deferred |
| Audit log viewer | `get_audit_logs` | none | none | Deferred |

## Everyone

| Flow | Route | Proof | Status |
|---|---|---|---|
| Health and readiness | health route | E2E `health` | Working |
| Sign-in, onboarding, workspace layout | sign-in, onboarding, `/b/<id>/…` | E2E `workspace`, `responsive` (desktop and mobile widths) | Working |
| Legal corpus sync | corpus load | pgTAP `legal_corpus` (passes on the clean checkout) | Working in the database |
| Bulletin (posts, pinning, limits, RLS) | bulletin route | Old E2E specs never ran; its pgTAP RLS test was deleted | Deferred |
| AI answers, explainers, drafting, credits, payments | AI and payment routes | Excluded | Disabled |

## Production (operator required)

No operator was available in this session. Nothing below has been verified, and nothing hosted has been changed.

| Item | Status | What is needed |
|---|---|---|
| Hosted migration history reconciled with `supabase/migrations` | Blocked | Operator reads the hosted migration table and reports the gap. No migration is applied without written approval |
| Vercel environment-variable names present (values not shown) | Blocked | Operator lists variable names for production and preview against `.env.example` |
| `SERVER_SIGNING_SECRET` matches the database's signing secret | Blocked | Operator performs the signing check through the approved secure process |
| Malware scanner (`FILE_SCAN_URL`, `FILE_SCAN_TOKEN`) | Blocked | A real scanner endpoint is configured. Production ingestion fails closed without it |
| Email delivery for invitations | Blocked | Provider configured, sender verified, and staging allowlist set |
| Groq answer and fast models (`GROQ_API_KEY`, `AI_ANSWER_MODEL`) | Blocked (AI is disabled for launch) | Configured only when AI is enabled. Eval gate (doc 04) must pass first |
| Inngest keys, Upstash, Voyage | Blocked | Operator confirms which are required for launch |
| Deployed upload size limit | Blocked | Operator reports the limit on the deployed app, and it is compared with the app's limit |
| GitHub workflow passes on the final commit | Blocked | Branch push approval (see the final report) |
