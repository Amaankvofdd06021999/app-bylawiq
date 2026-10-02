# Coverage: what has been gathered, and what has not

As at 2026-10-01. This answers one question — *have we got all the laws and all the decisions?* —
and it answers it with counts rather than impressions. Where something is missing, the reason is
named and it is a decision someone has to make, not work left undone.

Short version: **the law we are permitted to hold is complete. The decisions are completely
indexed and none of them can be shipped yet, because nobody has given us permission.**

---

## 1. Law — complete for both instruments in scope

| Instrument | Held | Gaps |
|---|---|---|
| Strata Property Act, SBC 1998 c 43 | 303 sections + the 29 Standard Bylaws | None. The 7 omitted groups are repealed or spent and are recorded with the placeholder text BC Laws itself shows. |
| Strata Property Regulation, BC Reg 43/2000 | 91 sections + 27 prescribed forms (Forms A to Z.1) | None. One of the 27, Form J, is repealed and held as such. |

**450 law items**, verbatim, current to 2026-09-22, under the King's Printer Licence – British
Columbia v1.1. Nothing in either instrument is now missing. The Schedule of Forms was the last
gap and closed on 2026-10-01; before that, three kb items had to hedge about whether the
Information Certificate really is "Form B". It is (s 59), the Certificate of Payment is Form F
(s 115), and the Notice of Tenant's Responsibilities is Form K (s 146).

### What "complete" does not cover

Other instruments that touch strata life — the Bare Land Strata Regulations, the Short-Term Rental
Accommodations Act, the Real Estate Services Act and Rules, tobacco and vapour legislation,
building and fire safety instruments — are **not in scope yet and have not been fetched**. That is
open question 38, waiting on a product and legal decision, not an oversight. The `smoking-cannabis`
guide currently has to say the Act and Regulation are silent, because for us they are.

### The access blocker

**BC Laws robots.txt disallows every automated client** except Googlebot and Bingbot (read
2026-09-30, open question 24). The Act and Regulation in the kb were fetched before that was read,
and every import since has run `--offline` against the cache. So:

- Re-importing what we have: fine, works offline.
- Fetching anything new from BC Laws, including a fresh consolidation: **stopped** until someone
  decides. This is a conflict about access, not about rights — the licence permits the content use.

That means the law is complete *and* currently frozen. A quarterly refresh (task F1) cannot run
until question 24 is answered.

---

## 2. Decisions — completely indexed, entirely unshippable

**11,286 decisions and judgments indexed**, in `decision-candidates/`. Every collection was paged
from the first result to the last, and every parsed count was reconciled against the source's own
total before it was believed.

| Source | Rows | Span | Completeness |
|---|---|---|---|
| CRT, Strata Property collection | 2,832 (+9 uncited) | 2016–2026 | Every decision in the collection. |
| CRT, all six other collections | 998 | 2017–2026 | Every decision in any other collection that mentions strata. All seven collections swept. |
| BC Supreme Court and Court of Appeal | 7,447 | 1990–2026 | Every judgment the court search reaches for `strata`, `condominium` or `Condominium Act`, back to the start of the database. |

### Zero of these are in the knowledge base

Not one decision item ships, and that is deliberate. No reuse licence exists for either body:

- **CRT decisions**: no licence found; treated as all rights reserved (answered question 2). Open
  question 19 is the written request to the CRT.
- **Court judgments**: `/jdb-txt/` — where the judgments live — is disallowed by robots.txt, so no
  judgment text has ever been read by this project. Open question 18 is the written application to
  the Supreme Court and Court of Appeal.

The indexes therefore hold citation (or file id), date, court or collection, official URL, and
which search found the row. **No reasons, no excerpts, and no style of cause** — the names of
private individuals are not kept.

### The one source that is out of reach

The **Provincial Court of BC** publishes judgments only through CanLII: every judgment link on its
own site points at `canlii.org/en/bc/bcpc/`, and CanLII is link-only for us. Since 2017 the CRT has
jurisdiction over most strata disputes, so the gap is mainly pre-2017 small claims. Open question
39. The **BC Human Rights Tribunal** is the same shape: CanLII only, no self-hosted decisions.

---

## 3. What would actually change the answer

Ranked by how much each unlocks, which is not the same as how hard each is.

1. **Question 18 and 19 — permission to use decisions.** 11,286 indexed rows are worth nothing to a
   user until one of these is granted. This is the single largest blocked asset in the project.
2. **Question 24 — BC Laws access.** Without it the corpus cannot be refreshed, so "current to
   2026-09-22" ages from here. The law being complete today is a perishable fact.
3. **Question 38 — scope beyond the Act and Regulation.** Decides whether whole topic areas stop
   having to answer "the Act and Regulation are silent".
4. **Question 15 — generating completed forms.** We hold the prescribed content; whether BylawIQ may
   produce a filled-in Form B for a building is a separate licence question.

## 4. How to check this is still true

```
pnpm import:bclaws --offline   # law is unchanged and re-imports clean
pnpm validate && pnpm build    # every item still passes
```

For decisions, re-run the scripts in `decision-candidates/scripts/` and diff the indexes; they are
cached, so a re-run fetches only what is new. Read that folder's README first — it records the two
silent parser faults this project has already shipped, both of which looked like healthy runs.
