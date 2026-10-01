# Decision candidates

Decisions worth summarising, for Phase C of `../research-bot-plan.md`. Research material: nothing
here is a kb item, nothing here is shipped, and nothing here states a holding.

## The complete indexes

- `crt-index.jsonl` — **every** decision in the Civil Resolution Tribunal's Strata Property
  collection as at 2026-10-01: 2,832 decisions, 2016 to 2026, by neutral citation, date, decision
  type and official URL. Built by paging the collection by date, so it is not biased by any choice
  of search terms.
- `crt-index-uncited.json` — the 9 decisions published without a neutral citation, recorded by date
  and type only. They carry a style of cause, and rule 6 forbids keeping the names of private
  individuals.
- `courts-index.jsonl` — 763 BC Supreme Court and Court of Appeal judgments, 2000 to 2026. 739 of
  them contain the exact phrase "Strata Property Act"; the rest were found by topical phrase
  searches. Complete for that method, which is not the same as complete for the subject.

## The curated selections

- `crt.md` — 150 CRT decisions chosen for topic coverage, each with a one-line reason. A sample of
  the index above, and the right starting point for Phase C3, because the index has no reasons.
- `courts.md` — the court judgments, grouped by the phrase that found them. **No reasons**: the
  judgments live behind a robots.txt disallow and could not be read.

## Rules that apply to all of it

No decision text, no party names, no strata plan numbers, no unit numbers. Citation, date, type and
URL are facts, and are what the licensing register permits today.

A candidate becomes an item only in Phase C3, and only once the CRT or the courts have answered the
permission requests in `../open-questions.md` (items 18 and 19), or a person has marked C3 approved
in the plan. Read the decision in full before writing anything about it: a line in these files is a
lead, not a finding.

## Refreshing

Both indexes are sorted by date, so a later run appends near the end and `git diff` shows exactly
what is new. That is the intended mechanism for the monthly decisions sweep (task F2). The scripts
are not committed: they live in the session scratchpad, and re-running them is a matter of paging
the same two search endpoints. Promoting them into `kb/tools/` is worth doing when F2 is automated,
which waits on open question 37.
