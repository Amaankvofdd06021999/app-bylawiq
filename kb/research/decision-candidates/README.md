# Decision candidates

Decisions worth summarising, for Phase C of `../research-bot-plan.md`. Research material: nothing
here is a kb item, nothing here is shipped, and nothing here states a holding.

## The complete indexes

As at 2026-10-01. Built by paging each collection to its end, not by sampling keywords, so each is
complete for the method named and a later run can diff it to find what is new (task F2).

| File | Rows | Span | What it is |
|---|---|---|---|
| `crt-index.jsonl` | 2,832 | 2016–2026 | **Every** decision in the CRT's Strata Property collection. |
| `crt-index-uncited.json` | 9 | — | Strata Property decisions published with no neutral citation, by date and type only. |
| `crt-adjacent-index.jsonl` | 957 | 2017–2026 | Decisions in the CRT's **other** collections that mention strata: 904 small claims, 53 societies and co-ops. |
| `courts-index.jsonl` | 4,790 | **1990–2026** | BC Supreme Court and Court of Appeal judgments, 3,946 BCSC and 844 BCCA. |

**8,588 rows in total.** Each is citation (where one exists), date, court or collection, official
URL, and which search found it.

## Three things to know before using them

**The CRT's Strata Property collection is not the whole CRT story.** 2024 BCCRT 1181 notes that
water leak disputes between owners are usually decided in the tribunal's small claims jurisdiction.
That is why `crt-adjacent-index.jsonl` exists. It is kept separate because it is noisy: many of
those decisions are not about strata at all and merely cite a case whose style of cause contains
"Strata Plan" — `Downing v. Strata Plan VR2356` appeared in three of six sampled snippets, cited for
whether an oral hearing is needed on credibility. 704 of the 957 also match a more discriminating
term (`strata corporation`, `strata lot` or `Strata Property Act`), and those carry
`matched_narrow`. Treat a row without it as unverified.

**The two sites search differently, and it matters.** bccourts.ca is phrase-based: a word-bag query
such as "pet bylaw strata" returns nothing while "pet bylaw" returns results. The CRT is
AND-of-words: "strata zebra" returns 0, so all words must appear but need not be adjacent. That is
why `strata fees` matched 1,445 of 1,451 small claims decisions and is no signal at all, and why it
was left out of the confidence terms.

**463 judgments have no neutral citation.** BC neutral citations began around 1999, so everything
older is keyed by its file id instead. They are the oldest and most easily lost rows in the set: a
citation-keyed parser drops them silently, which is exactly what happened on the first pass before
the running total was reconciled against the site's own count.

The broad `strata` search also carries real noise in the older years — the earliest hit, from
January 1990, is a mining case using "strata" in the geological sense. Filter on `found_by` to
`phrase:Strata Property Act` or `phrase:Condominium Act` for high-confidence strata law.

## The curated selection

`crt.md` holds 150 CRT decisions chosen for topic coverage, each with a one-line reason. It is a
sample of the index, and the right starting point for Phase C3, because the index has no reasons.
`courts.md` groups the judgments by the phrase that found them and has **no reasons at all**: the
judgments live behind a robots.txt disallow and could not be read.

## Rules that apply to all of it

No decision text, no party names, no strata plan numbers, no unit numbers. Citation, date, type and
URL are facts, and are what the licensing register permits today. **No decision document was fetched
from either site, in any pass** — only search result pages.

A candidate becomes an item only in Phase C3, and only once the CRT or the courts have answered the
permission requests in `../open-questions.md` (items 18 and 19), or a person has marked C3 approved.
Read the decision in full before writing anything about it: a line in these files is a lead, not a
finding.

## Refreshing

Every index is sorted by date, so a later run appends near the end and `git diff` shows exactly what
is new. That is the mechanism for the monthly decisions sweep (task F2). The collection scripts are
not committed; they live in the session scratchpad. Promoting them into `kb/tools/` is worth doing
when F2 is automated, which waits on open question 37.
