# Test exclusions

Every skipped or `fixme` test in the launch E2E run, and every legacy test kept out of it. A skipped or `fixme` test is not
coverage. Nothing listed here counts as release evidence.

Source of the counts: a clean checkout of `df7416f`, `npx playwright test --list` (84 tests per project), and the run
`node scripts/e2e-local.mjs --reporter=line` (149 passed, 0 failed, 19 skipped).

## Runtime skips in the launch run: 19 of 19 mapped

### Mobile project: 17 skipped

`demo.spec.ts`, `beforeEach` skips every demo test when the project is not desktop (`demo.spec.ts:9`): **10 tests.**

- each person lands where their role begins, with navigation scoped to their permissions
- the platform admin turns resident AI off, and Ask disappears for the resident
- drafting help is blocked until counsel approves it, and no draft is written
- a resident sees only the documents marked visible to owners
- a direct link to a building outside the person's access shows the access-removed notice, not that building's data
- a sent draft reaches strata management's review inbox and can be approved (also always skipped, see below)
- a strata manager's answer adds Coastline's internal practice, and a building manager's never does
- a resident out of credits buys more from the chat paywall and her question is answered
- a resident out of credits sees the paywall on Ask before any conversation is started
- drafting is blocked even when the resident has credits, so no paywall or charge is offered

`responsive.spec.ts`, `desktopOnly()` skips these on mobile (`responsive.spec.ts:51`): **6 tests.** Each layout test runs
once, on desktop, with its own device contexts for each width.

- no page scrolls sideways and the top bar stays on one line at any width
- controls are at least 44px on touch screens
- tables fit phones without sideways scrolling
- the phone menu does not repeat the bottom bar
- the ask box and filter tabs stay on one row on phones
- role dashboards fit every width, keep touch targets large and pass axe

`workspace.spec.ts`, desktop-layout test (`workspace.spec.ts:55`): **1 test.** It runs on desktop.

- bottom bar stays out of the desktop layout

### Desktop project: 2 skipped

- `demo.spec.ts`, "a sent draft reaches strata management's review inbox and can be approved" (`demo.spec.ts:139`,
  `test.skip`, always skipped). Demo-only and built on seeded demo data. The real firm review workflow is covered by
  `tests/e2e/firm-review.spec.ts` and `supabase/tests/firm_review.test.sql`.
- `workspace.spec.ts`, "mobile bottom bar reaches the main sections" (`workspace.spec.ts:37`): **1 test.** It runs on
  mobile.

Total: 17 mobile + 2 desktop = **19 skipped**. Every skip is a layout or demo scope rule, except the always-skipped demo
test, which is excluded for the reason above. No skip hides a launch-scope flow on a project where that flow is not
tested. Launch flows are checked on both projects, or on desktop with the layout checks on both widths.

## Demo tests that run (9 on desktop): demo-only, not release evidence

The other nine demo tests run on desktop, against the mock store. They are demo-only and do not prove the real app works.
Three of them exercise features that are disabled for launch:

- "the platform admin turns resident AI off, and Ask disappears for the resident" checks the disabled state.
- "a resident out of credits buys more from the chat paywall and her question is answered" and "a resident out of credits
  sees the paywall on Ask before any conversation is started" exercise the paywall and purchase flow. Payments are not
  launch scope. These passing demo tests are not evidence that payments or resident Ask work.
- "drafting is blocked even when the resident has credits, so no paywall or charge is offered" and "drafting help is
  blocked until counsel approves it" check the blocked state (decision D5). They are not evidence that drafting works.

## Legacy specs outside the launch run: 41 tests, not run

These are placeholders written against an earlier design. They never ran against the real app, and CI does not run them.

- `e2e/bulletin.spec.ts` at the repository root (committed): **27 tests**, written as plain `test(...)` placeholders.
- `e2e/chat-rag.spec.ts` at the repository root (committed): **14 tests**, written as plain `test(...)` placeholders.

Playwright's `testDir` is `tests/e2e`, so neither file runs. Uncommitted copies in `tests/e2e/bulletin.spec.ts` and
`tests/e2e/chat-rag.spec.ts` mark the same tests `test.fixme` (27 and 14). They stay in the backlog and are not committed to
the launch candidate. Before the bulletin feature or resident Ask is claimed, each test needs rewriting against the real
app.

- Bulletin is not claimed for launch. Its access, pinning and length rules need real-app tests before it is enabled.
- Resident Ask is off for launch (D5, D12). Resident credits and cross-building Ask for managers are not claimed here.
  Manager Ask paths are covered by `tests/e2e/building-documents-ask.spec.ts`. Portfolio Ask and analytics are not covered
  and are not claimed.

## What counts as release evidence

- Real-app E2E in `tests/e2e` that runs and passes on both projects, or on desktop with a layout check on both widths.
- pgTAP tests in `supabase/tests` in the committed suite (204 checks across 12 files).

Demo tests, `fixme` tests, and anything listed above are not release evidence.
