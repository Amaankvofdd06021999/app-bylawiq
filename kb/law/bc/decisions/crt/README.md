# CRT decisions

Civil Resolution Tribunal strata property decisions, type `crt-decision`, licence `crt-decisions` (or `canlii` for link-only items).

Each item is a structured summary with these sections, in this order:

- **Facts**
- **Issue**
- **Holding**
- **Principle**

`citation` is the neutral citation, `in_force_from` is the decision date, and `cites[]` lists the Act and Regulation sections the decision applies. Id pattern: the neutral citation, lower-case and dashed, prefixed `bc.crt.`.

Target: 50 to 100 decisions spread across the taxonomy (research plan R4). Keep a coverage table here once items exist.

## Licensing rule (enforced by the validator)

No reuse licence for CRT decisions has been found (see `research/licensing-register.md`), so until the CRT confirms reuse in writing (TODO(legal), `research/open-questions.md` item 19):

- An item is the neutral citation, a link to the decision and our own reviewed summary. Never copy the decision text. A brief attributed quotation is the most an item may carry: `tools/validate.ts` rejects more than 400 characters of block-quoted text.
- No party names anywhere. `title` and `citation` are the neutral citation (for example `2024 BCCRT 123`); the validator rejects a style of cause (`X v. Y`). Do not name parties in the body either; say "the owner", "the strata corporation".
- The four headings above are required, in that order.
- Attribution when shown: "Source: Civil Resolution Tribunal, [neutral citation], decisions.civilresolutionbc.ca".
- Never copy from CanLII.
- Fetching the decisions site: the licensing research of 2026-09-30 recorded that it returns 403 to
  automated clients. On the same day it returned HTTP 200 to an identified client, and its
  `robots.txt` disallows only the crawler BUbiNG and two specific document paths. The candidate
  list in `research/decision-candidates/crt.md` was built on that basis: 37 sequential search
  requests, 2 seconds apart, storing citations, dates and URLs and no decision text. **A person
  should confirm that method before it is used again** — see open question 35. Whatever the
  answer, the licence position is unchanged: no decision text may be stored.

Empty until research fills it. Never write a holding from memory.

## Candidates

The list of decisions to summarise is **`research/decision-candidates/crt.md`** (150 decisions, all
29 taxonomy topics, 2017 to 2026). It is in `research/` and not here because every `.md` file under
`law/` other than a README is loaded as an item and shipped in `dist/corpus.jsonl`; a candidate list
here would be retrievable, and an answer could then cite a decision nobody has read. See open
question 34.
