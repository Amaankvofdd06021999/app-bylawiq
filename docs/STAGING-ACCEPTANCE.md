# Staging and operator acceptance

This is the runbook for taking the reviewed candidate to a real staging environment, and the evidence an authorized
operator must record. Every check is currently **blocked**: no staging project, no operator and no hosted access are
available in the session that wrote this. Record evidence in the Evidence column. Record only what was run. Do not fill in a
pass from the local stack or from CI.

## Ground rules

- **No hosted migration is applied** without written approval after the history check in §1.
- **Record names, never values.** Variable names, project refs and pass or fail results are fine to record. Keys, secrets and
  connection strings are not.
- **Keep AI Ask off.** `answers` is false in `lib/launch-scope.ts`. Staging must return 403 `feature_unavailable` for every
  answer request.
- **Stop and report** on the first failure of a pass criterion. Do not work around it on the hosted system.

## 1. Migration history (before any migration is proposed)

| Check | How | Pass | Evidence | Status |
|---|---|---|---|---|
| Hosted history matches the repository | Operator runs `supabase migration list --linked` against the staging project and compares it with the 68 files in `supabase/migrations/` | Every repository version is applied, or no version is missing from the hosted list. Any gap, extra or out-of-order version is reported and stops the rollout | | **Blocked** |
| Rollback path for each pending migration | Read the migration's rollback notes or `supabase/rollbacks/` | Each pending migration is reversible or documented as not reversible, with the reason | | **Blocked** |

Propose migrations only after both rows pass. Apply them only with approval recorded here.

## 2. Vercel configuration (names only)

Operator runs `vercel env ls` for the staging target and records the names present.

**Required by name** (from `.env.example` and `lib/env.ts`):

`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SERVER_SIGNING_SECRET`, `DATABASE_ENVIRONMENT` (must be `preview` or `production` to match the target), `GROQ_API_KEY`,
`VOYAGE_API_KEY`, `AI_ANSWER_MODEL`, `AI_FAST_MODEL`, `AI_STRUCTURE_MODEL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`,
`FILE_SCAN_URL`, `FILE_SCAN_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_MODE`, `EMAIL_STAGING_ALLOWLIST`,
`LEGAL_CORPUS_INGEST_ENABLED`, `KB_DIST_DIR`.

Optional: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (rate limiting falls back to the database).

**Must be unset on staging:**

| Name | Why |
|---|---|
| `DEMO_MODE` | Every `/demo` route must be a 404 outside local and CI (`.env.example`) |
| `AI_PROVIDER` | `local-stub` is refused on Vercel, and must never reach a hosted environment |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Payments are out of launch scope |
| `PRODUCTION_SUPABASE_URL` on a preview or staging target | Preview and staging must not point at the production database (`publicEnv`) |

**Set on staging, with values fixed by this runbook:** `LEGAL_CORPUS_INGEST_ENABLED=false`, `EMAIL_MODE=staging`.

Gaps found while writing this runbook: `.env.example` does not list `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_MODE` or
`EMAIL_STAGING_ALLOWLIST`, which the code reads. It also lists `KB_DIST_DIR` without a production note. Fix the template before
the staging target is configured from it.

| Check | Pass | Evidence | Status |
|---|---|---|---|
| Names present match the required list; must-unset names are absent | Every required name is set, and no must-unset name is set | | **Blocked** |
| `DATABASE_ENVIRONMENT` and the database URL match the target | Staging targets the staging database, not production | | **Blocked** |

## 3. Signing readiness

| Check | Pass | Evidence | Status |
|---|---|---|---|
| `SERVER_SIGNING_SECRET` matches the database's server-signing secret | Operator-run probe reports a match. The pgTAP `signing_key_probe` test is the reference for what the database expects. Record the boolean only | | **Blocked** |

## 4. Scanner and upload limit

| Check | Pass | Evidence | Status |
|---|---|---|---|
| `FILE_SCAN_URL` is reachable with `FILE_SCAN_TOKEN` | A clean test file is accepted (`clean: true`) | | **Blocked** |
| A known-bad test file is rejected | The scanner returns `clean: false`; the app records the rejection and indexes nothing | | **Blocked** |
| Scanner outage fails closed | With the scanner unreachable, upload returns an error, and no document is stored as ready | | **Blocked** |
| Deployed upload limit | An upload of 4 MB is accepted and 4 MB + 1 byte is refused in the form, matching the E2E test "an upload over the 4 MB limit is refused". Also confirm the platform body limit does not refuse a 4 MB file before the app does | | **Blocked** |

## 5. Email (invitations)

Invitation **creation** is tested. **Delivery** is what this section verifies. The E2E suite does not send email.

| Check | Pass | Evidence | Status |
|---|---|---|---|
| Sender domain verified with the provider | Provider reports the domain as verified | | **Blocked** |
| `EMAIL_MODE=staging`, allowlist set to operator-owned test addresses | An invitation to a non-allowlisted address returns `skipped_staging` and sends nothing | | **Blocked** |
| Invitation to an allowlisted address is delivered | Message reaches the inbox. Record the provider message id and the time | | **Blocked** |
| Delivery failure is reported, not hidden | A provider error yields `failed` with the fixed message, not the provider text | | **Blocked** |

## 6. Background services

| Check | Pass | Evidence | Status |
|---|---|---|---|
| Inngest event and signing keys work; `/api/inngest` is registered | A test document ingests and reaches `review` (the `building-documents-ask` ingest path) | | **Blocked** |
| `LEGAL_CORPUS_INGEST_ENABLED` is false | Corpus sync does not run on staging | | **Blocked** |

## 7. Ask is off

| Check | Pass | Evidence | Status |
|---|---|---|---|
| `POST /api/chat`, stream and stop return 403 `feature_unavailable` for a signed-in manager | Status and body match | | **Blocked** |
| `/b/<id>/ask` shows "Ask is not available in this release" with no question box | Page content matches | | **Blocked** |
| `/demo` returns 404 | Status is 404 | | **Blocked** |

## 8. Five-role acceptance on staging

Run each flow on staging with the launch configuration. Record each result as Pass, Fail (with the failure) or Not run.
Denials are part of acceptance: each role is checked against another role's data by direct id.

| Role | Flow | Expected | Denial to check | Evidence | Status |
|---|---|---|---|---|---|
| Building manager | Sign in, open building home | Home shows the building's own data | Other building's home by direct id refused | | **Blocked** |
| Building manager | Upload a bylaw, see it reach review, confirm structure, become ready | Document reaches `ready` | Another building's manager cannot see or upload into it | | **Blocked** |
| Building manager | Notices and disputes; bylaw move to adopted | Each step persists; resolution leaves home | Resident and other building refused | | **Blocked** |
| Building manager | Invite a resident with a unit; email delivered (§5) | Invitation created and delivered | Invitation to a non-allowlisted address is skipped | | **Blocked** |
| Portfolio manager | Portfolio view and switching between linked buildings | Only linked buildings listed with counts | Outsider sees none | | **Blocked** |
| Firm owner | Onboard, link building by code, roster, team invite | Roster and team persist | Other firm sees neither roster nor buildings; direct id refused | | **Blocked** |
| Firm owner | Review inbox: send, request changes, approve a notice | Decision recorded with the approver | Unlinked firm refused | | **Blocked** |
| Firm owner | Publish a firm knowledge document | Document visible to that firm | Duplicate refused; other firm sees none | | **Blocked** |
| Resident | Accept invitation with the right email; land on home | Home shows in-force bylaws and unit status | Wrong email, reuse, expired and revoked invitations refused | | **Blocked** |
| Resident | Ask, drafting, paywall | Not available | Each returns the disabled state | | **Blocked** |
| Platform admin | Sign in, enrol authenticator, step-up, open console | Console opens only after MFA | Ordinary user sent away from `/admin/platform` | | **Blocked** |
| Platform admin | Expired-lease recovery and busy state | Second attempt runs after the lease expires | Stranger cannot release the lease | | **Blocked** |

## 9. Evidence log

| Date | Operator | Check | Result | Notes (names and results only) |
|---|---|---|---|---|
| | | | | |

## 10. Ask decision (step 5)

**Decision: launch with Ask unavailable.** The reasons, from the release checklist:

- The legal corpus is not approved or loaded. `kb/dist` is not in the repository, and `LEGAL_CORPUS_INGEST_ENABLED` is false.
- The eval gate has not run. `kb/dist/evals.jsonl` is absent.
- The answer model and embeddings are unverified against the real providers. The tests run on a stub.
- Signing, the scanner and the ingest path are unverified on a hosted system.

Ask is enabled only as a separate gated feature. Its acceptance criteria are:

1. Legal corpus approved in writing, loaded from `kb/dist`, and the corpus version recorded.
2. Eval gate passes on `openai/gpt-oss-120b` against the grounded-answer and no-grounding cases.
3. Real Groq and Voyage keys verified on staging, and the model IDs checked against Groq's list on the release date.
4. Signing check (§3) and scanner (§4) pass on staging.
5. Staging tests: manager Ask answers with a citation and effective date; no-source questions are refused; another building's
   manager gets the same denial as in `ask-launch-denial.spec.ts` on the real model.
6. `answers` flipped in code through review, then the denial tests in `tests/e2e/ask-launch-denial.spec.ts` are replaced by
   the positive tests.

## 11. Production decision (step 6)

Not made. It needs §1 to §8 passed with evidence and the operator's written approval. Until then, the release is not
production-ready.
