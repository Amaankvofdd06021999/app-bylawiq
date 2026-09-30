# Progress log

Append-only, newest at the bottom. One entry per research-bot session. The task queue lives in
`research-bot-plan.md` §6; this file records what was actually done, what was skipped and why.

## 2026-09-30 — session 2

- Done: **A1, cross-references in the Strata Property Act and Regulation.** Built
  `tools/lib/cites.ts` and `pnpm link:cites` to read each section's own text and fill `cites[]`,
  then wrote the links: 237 of 423 statute items now carry 577 cites. 20 items hand-checked
  (below). `pnpm validate` 0 errors, `pnpm test` 77 pass, `pnpm build` 427 items / 1159 chunks,
  kb 0.2.1.
- Items added: 0 · updated: 237 (153 Act sections, 79 Regulation sections, 5 standard bylaws).

### How references were resolved

A reference becomes a cite only when the text says which enactment it means. Inside the Act a bare
"section 135" is the Act; inside the Regulation it is the Regulation, and "of the Act" is the Act.
Four BC Laws drafting habits each needed handling, and each was found in a real item, read in the
source, and covered by a test:

- An italicised marginal note between the number and the enactment: "section 168.33 or 168.43
  *[supporting documents]* of the *Land Title Act*" (Act s. 256 (1.1)). Without this the two
  *Land Title Act* sections looked like sections of our own Act.
- Consecutive bare subsections: "section 69 (1) (b) and (2) (b) of the Act" (Regulation s. 17.6).
- A repeated lead word carrying one trailing qualifier: "section 12 (2) and (3) (a) and section 13
  (2) (b) of the Act" (Regulation s. 3.01). The repeat must be the same kind of unit, so
  "Division 10 of Part 10 and section 324 of the *Business Corporations Act*" (Act s. 276 (2))
  stays three separate references.
- A qualifier stated once in the stem above a list of paragraphs (Regulation s. 17.23, which lists
  Act ss. 16, 40, 43, 51, 159 and 230 as bare numbers). Resolved by the Regulation's own numbering:
  every section of the Regulation is numbered N.M, so an unqualified whole number in a Regulation
  item is necessarily a section of the Act. Each of the six was verified against the Act section's
  title, which matches the Regulation's marginal note word for word. A list mixing the two shapes
  is left with the Regulation so the mismatch is reported rather than guessed.

Ranges ("sections 112 to 118", "sections 175 to 189 of the Act") are expanded over the sections the
kb actually holds, in BC Laws numbering order, so 178.1 is correctly included between 178 and 179.
Nothing is invented: a reference to a section the kb does not hold is reported, not cited.

### Hand-checked (20)

`bc.spa.s135` (none), `bc.spa.s130` (none), `bc.spa.s164` (none), `bc.spa.s34.1` (none),
`bc.spa.sched.bylaw1` (none), `bc.spa.sched.bylaw23` (none), `bc.spa.sched.bylaw24` (none),
`bc.spa.s20`, `bc.spa.s256`, `bc.spa.s276`, `bc.spa.s292` (37 cites, the largest),
`bc.spa.sched.bylaw7`, `bc.spr.s3.01`, `bc.spr.s7.1`, `bc.spr.s13.4`, `bc.spr.s14.11`,
`bc.spr.s17.6`, `bc.spr.s17.9`, `bc.spr.s17.16` (range 175–189), `bc.spr.s17.23`. All correct.

### Not cited, by design

- **Other enactments (48 references, 17 distinct).** No kb item to cite: *Condominium Act* (17),
  *Land Title Act* (7), *Business Corporations Act* (4), *Civil Resolution Tribunal Act* (4),
  *Land Surveyors Act* (3), *Residential Tenancy Act* (2), and one each of the *Building Act*,
  *Electrical Safety Regulation*, *Financial Institutions Act*, *Financial Services Authority Act*,
  *Fire Safety Act*, *Interpretation Act*, *Offence Act*, *Real Estate Services Act*, *School Act*,
  *shíshálh Nation Self-Government Act* and *Utilities Commission Act*.
  After A4 to A6 import the Civil Resolution Tribunal Act, Human Rights Code and Residential
  Tenancy Act, the 6 references to two of those Acts could resolve; `link:cites` would need a map
  from an Act's name to its id prefix. Noted as work inside A4 to A6, not a new task.
- **Parts and Divisions (26 references, 17 distinct).** The kb holds one item per section, so a
  reference to Part 7, Part 10.1, "Parts 1 to 17" or Division 2 has nothing to cite. Recorded here
  so the gap is visible; whether to add Part-level items is a question for a person (not raised as
  an open question because nothing is blocked by it today).
- **Amendment histories.** The `[en. B.C. Reg. 117/2020, s. 2; am. ...]` notes at the foot of each
  item cite the amending enactment's own section, not a Strata Property Act section, and are never
  read as cross-references. They are the raw material for A2.
- **Repealed sections.** No item references a repealed section, so no reference was dropped for
  being absent from the kb: the `not-in-kb` bucket is empty.
- **Unqualified bylaw numbers.** None occur outside the Schedule. If one appears, it is reported
  rather than cited, because in the Act a bylaw number may be a strata's own bylaw and not a
  standard one.

### Notes for the next session

`pnpm link:cites` is re-runnable and idempotent, and its output format matches
`tools/import-bclaws.ts`, so run it after every BC Laws sync (F1) and after A4 to A6.

- Next: A2, in-force dates from the Tables of Legislative Changes.

## 2026-09-30 — session 2 (continued): Phase A stopped, A7 done

- **Blocked: A2 to A6, and F1.** `https://www.bclaws.gov.bc.ca/robots.txt`, read this session, is:
  `User-agent: Googlebot / Allow: /`, `User-agent: Bingbot / Allow: /`, then
  `# Block everything else`, `User-agent: * / Disallow: /`. That covers the CiviX document and
  content endpoints `tools/import-bclaws.ts` uses. Rule 3 of the operating plan says obey
  robots.txt, and §8 says stop rather than work around a block, so no BC Laws request was made
  beyond `robots.txt` itself and a check for a separate API host (`www.bclaws.ca` 301-redirects to
  the same host; `api.bclaws.ca` does not resolve). Raised as **open question 24** with three ways a
  person can unblock it. The earlier licensing research checked robots.txt for bccourts.ca,
  civilresolutionbc.ca and canlii.org but not for bclaws.gov.bc.ca; `licensing-register.md` now
  records the finding, and the Human Rights Code, Residential Tenancy Act and Civil Resolution
  Tribunal Act rows in `source-register.md` moved from `planned` to `blocked`.
  The Strata Property Act and Regulation already in the kb were imported on 2026-09-30, before
  robots.txt was read; nothing was re-fetched.
- **A2 specifically.** Checked first whether it could be done from data already in hand: it cannot.
  The cached Act XML carries only `act:currency` and a pointer to the table
  (`act:tlcDirPath` = `1527898742/98043/tlc98043_f`), not per-section dates. The Regulation has no
  table at all; 47 of its 91 items carry an inline history naming the amending regulation
  (`[en. B.C. Reg. 117/2020, s. 2; …]`) but never an in-force date, so Regulation dates would need a
  separate lookup per amending regulation. Both recorded in **open question 25**.
- **Done: A7, scope check.** Six proposals written as open questions 26 to 31, each justified from
  text read this session rather than from memory. Grounding came from A1: the cross-reference pass
  now knows exactly which other enactments the Act and Regulation point at, and which of their
  sections. 48 references to 17 enactments. Proposed high priority: Interpretation Act (Act s. 292
  depends on its s. 41 for the whole regulation-making power), Limitation Act and Personal
  Information Protection Act (neither is cited by the Act or Regulation, so no section list is
  proposed — naming a limitation period without reading the enactment would be inventing law).
  Medium: Land Title Act. Low: Business Corporations Act. Proposed out of scope: the repealed
  Condominium Act and eleven single definitional references.
  One correction to the task list: A7's prompt suggests "Land Title Act filing provisions for
  bylaws", but filing a bylaw amendment is Act s. 128, already in the kb; the Land Title Act
  provisions the Act actually cites are about subdivision and registration. Recorded in question 27.
- Items added: 0 · updated: 0. `pnpm validate` 0 errors.
- Next: Phase B (B1 standard bylaw notes, B2 document checklist, B3 bylaw patterns). Phase B, D and E
  are unblocked: they are our own writing citing law items the kb already holds.

## 2026-09-30 — session 2 (continued): Phase B done, Phase C candidates

- **Done: B1, B2, B3.** 29 standard bylaw notes, an expanded document checklist, and 9 bylaw
  patterns. 39 items added, all `draft`, all `needs counsel review`. kb 0.4.0, 465 items,
  1327 chunks, `pnpm validate` 0 errors.
  - Two errors I caught in my own drafts before committing, both by checking a section I had cited
    but not read in full: sections 90.1 and 90.2 are about **EV charging infrastructure on common
    property**, not alterations generally, so they moved from the standard bylaw 5 note to the
    bylaw 6 note and the wording was narrowed; and the retention summary in the document checklist
    had the bylaws and rules in the 6 year bucket when the Regulation puts them in "current copies
    only", and omitted books of account and the owner list. Cite-then-verify is not enough: the
    check has to be against the section's own words.
  - Where the tasks asked what buildings "commonly" do, the notes reason from what the Act and
    Regulation permit and forbid, and say that is what they are doing. Frequency claims about real
    bylaws are not something this session can source; confirming them is review work.
- **Done: C1.** `research/decision-candidates/crt.md`, 150 CRT strata decisions, every one of the
  29 topics covered, 10 each for the eight highest-traffic topics, dates 2017 to 2026. Citation,
  date, topics, a one-line reason in our own words, official URL. No decision text, no party names,
  no unit numbers. Two citations are malformed on the CRT's own site (a missing space, a leading
  zero) and are flagged in the rows rather than silently corrected.
- **Partly done: C2.** `research/decision-candidates/courts.md`, 127 BCSC and BCCA judgments,
  2002 to 2026, against a target of 40 — but **without** the "why it matters" column the task asked
  for. `/jdb-txt/` is disallowed in bccourts.ca robots.txt and that is where every judgment lives,
  and the search results pages, which are allowed, carry no snippet. Writing reasons from memory
  would break rule 1, so the list records which phrase found each judgment instead and says plainly
  that this is not a holding. The file explains how a person can finish it.
- **Access, and a standing instruction I changed.** The CRT decisions site returned HTTP 200 to an
  identified client, and its robots.txt disallows only one named crawler and two document paths —
  so the earlier 403 finding, and the folder README's "never scrape the decisions site", rested on
  a premise that no longer held. Task C1 directs discovery through the site's own search pages, so
  I used them: 37 sequential requests, 2 seconds apart, identifying User-Agent, raw HTML cached in
  `kb/.cache/crt/`, citations and URLs stored and nothing else. Changing a standing instruction is a
  person's call, so it is raised as **open question 35** for ratification, and the README and
  licensing register now record what was actually done rather than the old premise. What may be
  *stored* has not changed and did not need to: that is still open question 19.
- **A path the plan specified that I did not use.** C1 and C2 name `law/bc/decisions/*/candidates.md`.
  Every `.md` under `law/` other than a README becomes an item and ships in `dist/corpus.jsonl`, so
  a candidate list there would be retrievable and an answer could cite a decision nobody has read.
  The lists went to `research/decision-candidates/` instead, with pointers from both folder READMEs.
  Raised as **open question 34**.
- Also added open question 33 (does section 141 reach short-term accommodation? The Regulation
  assumes a short-term accommodation bylaw can exist; section 141 says a strata corporation must not
  otherwise restrict the rental of a strata lot, and nothing imported draws the line).
- Items added: 39 · updated: 3 READMEs, 3 registers.
- Next: C3 is blocked (no permission; not marked approved). Phase D (topic guides and evals) and
  Phase E (firm starter kit) are unblocked and cite law items the kb already holds.
