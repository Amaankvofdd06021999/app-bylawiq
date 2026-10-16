# Test exclusions

Every skipped or `fixme` test in `tests/e2e`, with its reason and release impact. A `fixme` test is not coverage. Nothing below is counted as release evidence.

## Legacy `fixme` specs (41 tests): not release evidence

These were written against the demo or an earlier design and never ran as real-app tests. They stay in the repository as a backlog, and each one needs rewriting against the real app before its feature is claimed.

| Spec | Count | Release impact |
|---|---|---|
| `bulletin.spec.ts` | 27 | The bulletin feature is not claimed for launch. Its access, pinning and length rules need real-app tests before it is enabled. |
| `chat-rag.spec.ts` | 14 | Resident Ask, resident credits, and cross-building Ask for managers. Resident Ask is off for launch (D5, D12). The manager Ask paths are covered by `building-documents-ask.spec.ts`. Portfolio Ask and analytics are not covered and are not claimed. |

## Layout specs skipped per project (5 markers)

These skip on one of the two projects by design, so each layout runs exactly once.

- `demo.spec.ts` line 9: a layout test that runs once, on desktop.
- `responsive.spec.ts` line 51: runs once, with its own device contexts.
- `workspace.spec.ts` lines 37 and 55: the mobile bottom bar runs on mobile only; the desktop layout runs on desktop only.

## Demo-only tests

- `demo.spec.ts`: "a sent draft reaches strata management's review inbox and can be approved" is excluded with `test.skip`. It is demo-only and built on seeded demo data. The real review workflow belongs to the firm-review slice, which is not built yet, so this path is not claimed.
- The drafting tests in `demo.spec.ts` now assert that drafting is blocked (decision D5). They are not evidence that drafting works.

## Rewritten, not excluded

- The three demo drafting tests were rewritten to assert the blocked state. They previously asserted that drafting worked.
