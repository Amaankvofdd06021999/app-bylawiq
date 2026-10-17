# Release checklist: five roles

Derived from `docs/LAUNCH-SECURITY-MATRIX.md`. Each row gives the route or database action, the authorization and RLS
proof (pgTAP in `supabase/tests`), the end-to-end proof (`tests/e2e`), and one status:

- **Working**: built, and proven by the committed tests on the clean checkout of the final candidate.
- **Disabled**: built or partly built, switched off for launch by decision. Not claimed.
- **Deferred**: not built, or built without tests. Not claimed for launch.
- **Blocked**: cannot be verified without production evidence from an authorized operator. See the production section.

A role is not complete while its deferred or blocked rows remain. Nothing in the Disabled or Deferred rows is evidence
for launch.

## 1. Building manager

| Flow | Route or action | Authorization and RLS proof | E2E proof | Status |
|---|---|---|---|---|
| Building home from database | `/b/<id>/home` | pgTAP `isolation`, `personas_authorization` | `building-manager-dashboard` (other manager refused by direct id) | Working |
| Upload and confirm documents | document upload actions | pgTAP `building_documents_slice` | `building-documents-ask` (retry refused to other building) | Working |
| Ask, scoped to this building | Ask route | pgTAP `building_documents_slice` | `building-documents-ask` | Working |
| Notices and updates | `/b/<id>/notices` | pgTAP `notices_disputes_authorization` (read, dismiss, reason required, resident and other building refused) | `building-notices-disputes` | Working |
| Bylaw draft, review, vote, adopt | `transition_bylaw` (`bylaw.adopt`) | pgTAP `notices_disputes_authorization` (resident and other building refused) | `building-notices-disputes` (adoption creates the update; no-majority refusal shows reason) | Working |
| Disputes: open and log events | `log_dispute_event` (`dispute.create`, `dispute.update`) | pgTAP `notices_disputes_authorization` (unknown stage refused) | `building-notices-disputes` (short summary refused; resolution leaves home) | Working |
| Send notice to firm for review | `request_firm_review` | pgTAP `firm_review` | `firm-review` (send, request changes, approve) | Working |
| Invite residents | `create_resident_invitation` (`member.invite`) | pgTAP `resident_join` (18) | `resident-join` (invite with unit, verify, denials) | Working in the app. Invitation email is **Blocked** (see production) |
| Verify resident units | `verify_resident_unit` | pgTAP `resident_join` | `resident-join` | Working |
| Drafting help | drafting actions | Demo tests assert the blocked state (D5) | Not an E2E test | Disabled |
| Resident-facing AI answers | resident Ask | Not claimed | Not claimed | Disabled |

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
