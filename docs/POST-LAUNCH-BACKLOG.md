# Post-launch backlog

Launch scope and the complete platform are different things. This file tracks everything that is deliberately out of the
launch release, so "launch-ready" is not read as "complete". Each item stays out of the release candidate until it is
reviewed, tested against the real app, and approved.

## Off in code for launch

| Item | Where it is off | What re-enabling needs |
|---|---|---|
| Building-manager Ask, resident Ask, portfolio Ask (`answers`) | `lib/launch-scope.ts`; enforced in `app/api/chat` (POST, stream, stop), `generateAnswer`, the Ask screen, the conversation page, and the admin analytics page | Legal corpus approved and loaded, eval gate passing, Groq and Voyage keys verified, signing secret matched, scanner in place. See `docs/RELEASE-CHECKLIST.md` |
| Resident drafting (notices, letters) | `residentDraftsAvailable()`, a code constant set to off (decision D5) | Counsel approval and a reviewed change to the constant |
| Resident credits, paywall, purchases | Depends on `answers`; demo only in the tests | Payment provider chosen and integrated; pricing approved |

## Not built, or built without launch tests

| Item | State | Needed before it can launch |
|---|---|---|
| Platform admin grant and revoke | Database functions and a pgTAP test exist only in the uncommitted backlog (`supabase/migrations/20261044…`, `supabase/tests/platform_admin_grants.test.sql`). No UI | Review the migration; an operator-approved process; an E2E test; a decision on whether grants are a UI feature |
| Feature flags (`set_flag`, `feature_flags`) | Functions exist; no UI test | End-to-end test, or mark unavailable in the console |
| Audit log viewer (`get_audit_logs`) | Function exists; no UI test | End-to-end test, or mark unavailable |
| Bulletin (posts, pinning, length limits, RLS) | Old E2E specs at the repository root never ran; `tests/e2e/bulletin.spec.ts` (uncommitted) is `test.fixme`; its pgTAP RLS test was deleted | Rewrite against the real app; add a pgTAP RLS test; load test (`scripts/load-test-bulletin.js`) |
| Portfolio Ask and analytics | Not built | Depends on `answers` |
| Semantic firm knowledge search | Text search only (`ts_rank`) | Embedding pipeline and retrieval tests |
| Chat and AI analytics | Admin page gated off | Depends on `answers`; analytics definitions approved |

## Test and documentation debt

- `tests/e2e/chat-rag.spec.ts` and `tests/e2e/demo` drafting and paywall tests: demo-only or fixme; not evidence for any launch feature.
- `tests/building-scope-functions.test.ts`, `tests/resident-drafts.test.ts`, `tests/wallet.test.ts` (uncommitted): not reviewed for launch.
- `docs/33-LOCAL-SETUP-MANUAL-TESTING.md`, `docs/34-ENVIRONMENT-VARS-DEPLOYMENT.md`, `SETUP-COMMANDS.md`, `START-DEV-SERVER.bat` (uncommitted): describe Anthropic keys, Stripe, chat and credits as test steps. Rewrite before they are committed.
- `scripts/initialize-ai-system.ts`, `scripts/load-test-bulletin.js` (uncommitted): AI and bulletin tooling, out of launch.
- Line-ending-only differences across about 30 files: no content change; do not commit.

## Where the uncommitted backlog lives

It is held in the git stash `backlog-2026-10-17` (`stash@{0}`), not in the release branch. Recover it with
`git stash show -p backlog-2026-10-17` to review, or `git stash pop` to restore. Its inventory is in the local scratchpad.
