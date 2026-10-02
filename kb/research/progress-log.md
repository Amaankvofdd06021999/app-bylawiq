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

## 2026-09-30 — session 2 (continued): topic guides and evals for the ten busiest topics

- **Done: D1 for the ten busiest topics** — pets, noise, rentals, short-term-rentals, fines,
  bylaw-enforcement-s135, hearings, water-leaks, strata-fees-arrears, privacy-records. Six headings
  each, every factual sentence citing a kb item inline and in `cites[]`. "What decisions have held"
  says what it is waiting for rather than being left blank. Each guide ends by saying it is not
  advice about a particular dispute and that a building's own registered bylaws come first.
- **Done: D2 for the same ten**, 6 cases each, 60 in all. Every set has at least one case whose
  correct result is "no grounding found", and several of those exist to catch a specific way the
  assistant could be confidently wrong: the provincial short-term rental registration scheme and
  the Personal Information Protection Act are not in the kb, and an answer that states what they
  require would be inventing law. The eval files are excluded from `dist/corpus.jsonl` (473 corpus
  items, 10 eval items) so expected answers can never be retrieved.
- The same discipline as Phase B on wording: three sentences that made claims about how often
  buildings do something, or how cases usually fail, were rewritten to say what the legislation
  provides. There are no decisions in the kb, so nothing can be said about outcomes.
- kb 0.5.0, 483 items, 1394 chunks, `pnpm validate` 0 errors, `pnpm test` 77 pass.
- Items added: 19 (9 guides, 10 eval sets) · updated: 1 (the pets guide skeleton was replaced).
- **Not done: D1 and D2 for the other 19 topics.** They are unblocked and the pattern is set; the
  work is the reading, since each guide is written from the sections it cites.

## 2026-09-30 — session 2 (continued): firm starter kit

- **Done: E1, E2, E3. Partly done: E4.** 12 firm items, all `draft`, all `needs counsel review`,
  each carrying a visible banner saying a BC-licensed lawyer has to review it before it is sent to
  anyone. kb 0.6.0, 494 items, 1478 chunks, `pnpm validate` 0 errors.
  - **Templates (5):** section 135 notice of complaint; notice to a landlord and owner about a
    tenant's contravention; response to a hearing request; decision letter after a hearing; notice
    of decision imposing a fine. Placeholders in `{{double_braces}}`, and every step cites the
    provision that requires it. Each template has a "before you send it" checklist, because the
    order of the steps is what section 135 is about.
  - **Policies (3):** complaint handling, records requests, accommodation requests.
  - **Guidance (3):** running a section 135 process start to finish, handling an accommodation
    request, responding to a records request. The section 135 note is organised around where each
    stage comes apart in practice, since the failure modes are procedural rather than substantive.
  - **Legal tracker (1 entry):** the 2022 removal of rental restrictions. It states the repeal
    citations recorded in the consolidation and says explicitly that **the in-force date is not in
    the kb** and must not be stated until the Tables of Legislative Changes have been read.
- **Two items are deliberately thin, and say so.** The accommodation policy and guidance give a
  process only. The *Human Rights Code* is not in the kb (task A5), so they do not state when
  accommodation is required or what undue hardship means; they say what the Act contributes
  (a bylaw is unenforceable to the extent it contravenes the Code), which two situations the Act
  answers outright so they are not accommodation questions at all, and that counsel decides the
  rest. Writing the test from memory would have been the easy thing and the wrong one.
- Items added: 12 (11 new, 1 replacing the section 135 notice skeleton) · updated: 4 READMEs.
- Next: D1 and D2 for the remaining 19 topics. Everything else in the queue is blocked on a person:
  A2 to A6 and F1 on question 24, C3 on questions 18 and 19, E4 on A2 and C3.

## 2026-09-30 — session 2 (continued): guides and evals for the whole taxonomy

- **Done: D1 and D2 in full.** The remaining 19 topics now have a guide and an eval set, so all 29
  taxonomy topics are covered: 29 guides and 29 eval sets with 159 cases. kb 0.7.0, 532 items,
  1608 chunks, `pnpm validate` 0 errors, `pnpm test` 77 pass.
- Sections read for this batch and cited for the first time: 4, 25, 27, 30, 32, 33, 34, 45, 48, 50,
  51, 52, 53, 56, 73, 74, 75, 77, 84, 85, 92, 93, 95, 96, 97, 98, 100, 109, 127, 136, 159, 161,
  164, 165, 189.1, and Regulation 6.1, 7.01 and 9.1.
- Two provisions worth flagging to whoever reviews these, because they change what an answer should
  say and are easy to miss:
  - **Section 189.1 (2)**: an owner or tenant may not ask the tribunal to resolve a strata dispute
    unless they first requested a council hearing under section 34.1, or the tribunal directs
    otherwise. That is the gate on the whole tribunal route and it is now in the `crt-process` and
    `hearings` guides.
  - **Regulation 6.1 (2)**: the annual contingency reserve fund contribution must be at least 10%
    of the operating fund budget, determined after considering the most recent depreciation report.
    It ties the reserve fund, the depreciation report and the budget together.
- Every guide's "what decisions have held" still says what it is waiting for. That is 29 places
  where an answer will be thinner than it should be until phase C3 is unblocked, and it is the
  strongest argument for pursuing open questions 18 and 19.
- Items added: 38 (19 guides, 19 eval sets).
- Next: nothing in the queue is unblocked. A2 to A6 and F1 wait on question 24; C3 on 18 and 19;
  E4 on A2 and C3; F2 on 19 and 35. Phase B, D and E are complete as drafts and now need review:
  a legal researcher for the law layer and counsel for the firm, building and topic layers.

## 2026-10-01 — session 3: making the corpus updatable

Asked for directly, and app-side rather than kb-only, so this session steps outside the operating
plan's rule 7 (`stay in kb/`) on instruction. Nothing in the kb task queue moved: A2 to A6 and F1
are still waiting on question 24, C3 on 18 and 19.

The gap this closes: the kb could be rebuilt, but nothing downstream could be *updated*. Re-running
the ingest would have inserted duplicate sources, a section whose text changed lost its old text
entirely, and an answer could not be traced to the legislation version behind it.

- **Previous text is now kept (question 5, answered).** `tools/import-bclaws.ts` writes the old text
  to `superseded/<section>.<consolidation-date>.md` under a dated id with `in_force_to` set, keeps
  its review sign-off, points the current item at it through `supersedes`, and prints what moved
  line by line. The stable id always holds the text in force now. New pure helpers in
  `tools/lib/supersede.ts` and `tools/lib/frontmatter.ts`, 15 tests; `replaceCitesLine` now shares
  the frontmatter editor rather than duplicating it. kb tests 77 to 92.
  Verified end to end by changing one section's text by hand, re-running `import:bclaws --offline`,
  checking the archive and the current item, then reverting.
  **The honest limit, repeated in each archived item and in the report:** `in_force_to` is the
  consolidation date the change was *found* on, not the date the amendment came into force. Leaving
  it null would be worse — both versions would then answer questions about today.
- **The corpus can be refreshed (question 6, answered).** Migration
  `20261001090000_legal_corpus_sync.sql` adds `kb_id` (partial unique index), `kb_version`,
  `supersedes_kb_id` and `content_sha256` to `legal_sources`. `scripts/ingest-kb.ts` upserts on
  `kb_id`, skips re-embedding any source whose content hash is unchanged, mirrors `in_force_to` and
  `supersedes` from the kb, records the sync time on `jurisdictions`, and reports sources in the
  database that are absent from the build without deleting them.
- **Embeddings wired (question 8, partly).** `voyage-law-2` at 1024 dimensions with the same
  contextual header the building corpus uses, because that is what the app and the shipped schema
  already require. `docs/02-DATA-MODEL.md` said 1536 and now carries a note. Confirming the model
  long term is still a person's call: changing it means re-embedding everything.
- **Answers are traceable to a corpus version.** `hybrid_search_legal` returns `kb_version` and
  `retrieval_traces.legal_kb_versions` records the versions actually used. When a section is
  amended, the answers and notices that relied on the old text can now be found.
- **Point-in-time retrieval proved, not assumed.** `hybrid_search_legal` already filtered both dates
  against the question's as-of date; four new tests in `tests/database.test.ts` pin it against real
  pgvector, and removing the filter makes exactly those tests fail. `supabase/tests/legal_corpus.test.sql`
  adds the same guarantees plus the privilege checks against real Postgres — that file has **not**
  been run locally, because this machine has no Docker or Supabase CLI; it runs in CI.
- **CI now covers the kb.** A third job runs `kb typecheck`, `test`, `validate`, `build`, and then
  the ingest dry run against the built corpus, so drift between what the kb emits and what the app
  reads fails the build.
- Gate: kb validate 0 errors (532 items), kb test 92 pass, app typecheck clean, lint unchanged
  (1 pre-existing warning), app tests 310 pass, `next build` succeeds.
- Not done, and needs a person: the scheduled job that actually runs the sync (F1/F2 are still
  manual), and surfacing staleness in the UI from `jurisdictions.last_synced_at`.

## 2026-10-01 — session 3 (continued): the ChatGPT research pack, and the gap it found

A second research pack was supplied at `kb/BylawIQ_Research_Pack_2026-09-30/`. It was read as leads,
not findings: it had no access to this repository and says so, so nothing in it was treated as
verified law. Where it pointed at a provision, that provision was read in the Act or Regulation in
this kb before anything was written.

- **It found a real gap, and an urgent one.** Its change watchlist named electrical planning report
  deadlines of 2026-12-31 and 2028-12-31. Checking the kb: Act s. 94.1 and Regulation Part 5.2
  (ss. 5.7 to 5.12) were **already imported and completely untagged** — `topics: []` — so the whole
  regime was invisible to topic retrieval and had no guide. The first deadline is three months from
  today. Verified from the Regulation's own text and acted on:
  - Two taxonomy topics added, `electrical-planning-reports` and `ev-charging`, and the relevant
    Act and Regulation sections tagged in `tools/lib/bclaws-topics.ts` (a duplicate-key check was
    added while doing it: four Regulation keys were being silently overridden).
  - Two topic guides, two eval sets (12 cases), a legal-tracker entry and a new entry in the
    onboarding document checklist.
  - The tracker entry is the only obligation in the kb with a deadline inside three months, and
    unlike the rental restriction entry its dates come from the Regulation's own text, so they do
    not wait on the Tables of Legislative Changes.
- **It independently confirmed the BC Laws robots.txt block** (question 24), using the same
  identifying User-Agent and stopping for the same reason. Two separate efforts reaching the same
  stop makes that a settled fact rather than one reading.
- **It recorded a 403 on the CRT decisions portal** on the same day our request returned 200. So
  that block is intermittent; the licensing register now says to treat any 403 as a stop whenever it
  appears, which strengthens question 35 rather than resolving it.
- **About 30 of its 40 sources were new**, now in `source-register.md` by publisher: the province's
  ~24 strata guidance pages, the BC Human Rights Tribunal, the LTSA, BCFSA, RTB Policy Guideline 27
  and the OIPC. None imported; none licensed for us yet.
- **Four new open questions**: 36 (the guidance pages are not King's Printer licensed, so decide
  what we may do with them), 37 (the province's own update subscription could trigger the F1 sync
  **without fetching from BC Laws at all**, which is the first route around question 24 that anyone
  has found), 38 (eight more instruments for the A7 scope list, including the bare land regulations
  and the actual Short-Term Rental Accommodations Act that question 33 said was missing), and 39
  (six more taxonomy gaps the kb already holds law for).
- kb 0.8.0, 537 items, 1632 chunks, validate 0 errors, 92 tests pass.
- The pack is committed because the registers now cite it. Its own README says not to index it, and
  it is not indexed: it sits outside the five content folders, so the loader never sees it.

## 2026-10-01 — session 3 (continued): the decision collections, completely this time

Asked directly whether the CRT site had been gone through completely. It had not: the C1 pass ran
one keyword search per topic and read the first page or two of each. Measured honestly, that was
777 distinct decisions out of a collection whose individual queries reported hundreds of hits each
— roughly a quarter, biased towards the words chosen. So both collections were enumerated properly.

- **CRT, now complete.** The Strata Property collection reports 2,842 decisions. Paging it by date
  rather than by keyword, 114 pages, yields **2,832 distinct decisions, 2016 to 2026**, in
  `decision-candidates/crt-index.jsonl`: citation, date, decision type, URL. 2,785 are final
  decisions; the rest are summary, preliminary, under appeal, after appeal, under judicial review or
  after judicial review. Nine are published **without a neutral citation**, mostly default
  decisions; they are in `crt-index-uncited.json` by date and type only, since those rows carry a
  style of cause. A third malformed citation turned up on the site (`2018  BCCRT  779`, double
  spaces) alongside the two already known.
- **Courts, as complete as this search allows.** Searching the exact phrase "Strata Property Act"
  and paging the whole result set gives 739 judgments; adding the 24 found by topical phrases that
  do not contain that phrase gives **763, 2000 to 2026, 629 BCSC and 134 BCCA**, in
  `courts-index.jsonl`. The honest limit is stated in the file: a phrase search finds judgments
  containing a phrase, so a strata judgment that never writes the Act's name and matched none of
  the topical phrases is not there.
- **Two transport problems worth recording**, because both looked like blocks and neither was. The
  court site's paging is an ASP.NET postback whose body runs to 50KB; HTTP/2 fails on it with a
  framing error, and the form needs a session cookie. Pinning to HTTP/1.1 and carrying a cookie jar
  fixed it. Neither is evasion — the User-Agent still identifies this bot and the path is one
  robots.txt allows. Separately, the court site serves both `/jdb-txt/` and `/Jdb-txt/`, and a
  case-sensitive pattern silently dropped 27 of 739 rows until it was caught by reconciling the
  parsed count against the site's own total.
- **No decision document was fetched from either site, in any pass.** Only search result pages.
- **What else is fetchable, checked and tabulated** in `licensing-register.md`. The short version:
  rights are the blocker, not access. BC Laws is the one source we are clearly licensed for and may
  not fetch (question 24). BCHRT and OIPC are fetchable and unlicensed. gov.bc.ca could not be
  reached by this client at all, on two attempts. BCFSA returns 403. LTSA allows everything but is a
  paid registry, not a corpus. CanLII is prohibited and was never touched.
- Both indexes are sorted by date, so a later run appends near the end and `git diff` shows what is
  new. That is the mechanism for the monthly decisions sweep (F2), which still waits on question 37
  for its trigger.
- Politeness throughout: sequential, 2 seconds apart, identifying User-Agent, raw HTML cached in
  `kb/.cache/` (git-ignored), stop on any non-200.

## 2026-10-01 — session 3 (continued): the full depth of both decision corpora

Asked to go back 30+ years and take everything. Two of the three limits turned out to be real, and
the third was mine.

- **The CRT cannot go back 30 years.** It only acquired strata jurisdiction in 2016, so the
  2,832 decisions already indexed are its entire history. There is nothing older to find.
- **The courts go back 36 years, and I had been missing all of it.** The judgment database holds
  strata-related judgments to **24 January 1990**. The earlier pass found 763 because it searched
  scattered phrases and read page one of each. Searching "strata" (the broadest term, 4,762 hits)
  and "Condominium Act" (347, for the pre-2000 regime) and paging both to the end gives
  **4,790 judgments, 1990 to 2026**: 3,946 BCSC, 844 BCCA; 467 from the 1990s, 1,048 from the
  2000s, 1,600 from the 2010s, 1,675 from the 2020s.
- **The oldest data nearly vanished silently.** 463 judgments have no neutral citation, because BC
  neutral citations only began around 1999. The parser was keyed on citation, so pages 91 to 96 —
  1990 to 1996, precisely the decade asked for — contributed zero rows and the run looked healthy.
  It was caught only because the running total stopped moving while pages kept being fetched. Those
  rows are now keyed by the file id in their URL. The lesson is the one from the `/Jdb-txt/` casing
  bug earlier the same day: reconcile the parsed count against the source's own total, every time.
- **The CRT's strata collection is not the whole CRT.** 2024 BCCRT 1181, already in the kb's
  candidate list, says water leak disputes between owners usually go to the small claims
  jurisdiction. Searching there found 1,451 strata-mentioning decisions, of which 906 carry a
  neutral citation; **543 of the 545 without one are default decisions**, where the respondent did
  not participate, so there is no reasoning to summarise either. With 53 from the societies and
  co-operatives collection, 957 are indexed in `crt-adjacent-index.jsonl`, kept **separate** from
  the strata index because sampling showed many are not strata matters at all — they cite
  `Downing v. Strata Plan VR2356` for an unrelated point about oral hearings. 704 also match a more
  discriminating term and are flagged.
- **The two search engines differ, which changes what a result means.** bccourts.ca is phrase-based
  ("pet bylaw strata" returns nothing, "pet bylaw" returns results). The CRT is AND-of-words
  ("strata zebra" returns 0). That is why `strata fees` matched 1,445 of 1,451 small claims
  decisions and was discarded as a confidence signal rather than trusted.
- **Breadth has a cost, and it is recorded.** "strata" matches the word in any sense; the earliest
  1990 hit is a mining case using it geologically. Every row carries `found_by`, so a reader can
  filter to the 739 judgments containing "Strata Property Act" or the 234 containing
  "Condominium Act".
- **BCHRT remains out of reach.** It self-hosts no decisions; every link on its law-library page
  points at CanLII, which we may not touch. Recorded in both registers.
- **8,588 rows across four files, about 1.8 MB.** All sorted by date, so a refresh appends near the
  end and `git diff` shows what is new — the F2 mechanism, which still waits on question 37.
- Still no decision document fetched from either site, in any pass. Only search result pages.
- One job was stopped at its time limit mid-run: the narrow-phrase confidence pass. Three of its
  five terms had completed and were cached, so the signal was built from those with no further
  requests; the two outstanding terms were the useless ones and were dropped deliberately.

## 2026-10-01 — The Schedule of Forms, and two coverage claims that were guesses

Asked to make sure all the laws and decisions had been gathered. Two things had been asserted
without being measured, and both were wrong.

### Law: the forms were the last gap, and they are now closed

- **All 27 prescribed forms imported** (Forms A to Z.1, under `forms/`, ids `bc.spr.form.<letter>`).
  The Act and Regulation are now complete: nothing in either is unheld.
- Parsed by a separate parser, `tools/lib/forms.ts`, because a form is a document and not a
  provision — a letter rather than a number, a name rather than a marginal note, free text and
  tables with dotted blanks. Every word is kept in published order; the layout is simplified and
  each item's `notes` says so, so nobody mistakes an item for a filable form.
- **Three items had been hedging, and all three were right to.** The kb could not confirm that the
  Information Certificate is "Form B" because it did not hold the Schedule. It is, for section 59.
  Certificate of Payment is Form F (s 115), Notice of Tenant's Responsibilities is Form K (s 146),
  Amendment to Bylaws is Form I (s 128). Those hedges are gone.
- **Form J is repealed** (B.C. Reg. 6/2023, s. 7) and still occupies its letter. Imported with its
  published "Repealed." text, so the question is answered rather than met with silence.
- A form's `cites` come from the reference BC Laws prints under its name, not from `link:cites`.
  That reference distinguishes the Act's sections from the Regulation's; a bare "Section 59" inside
  a Regulation item would otherwise resolve to the wrong enactment.
- Only one image exists in the Schedule, the 12px tick box, written as `[ ]`. Any other graphic
  stops the import: the licence does not cover the coat of arms or government logos.
- Two faults in shared code found on the way: `inline()` trimmed every fragment, deleting the space
  that separates it from the next one; and `.map(inline)` was passing the array index into the new
  handler argument. Both fixed, 123 tests green.
- While in the fees guide: **section 115 was not covered at all.** The Certificate of Payment, its
  60-day currency, its $15 cap, the bar on including undetermined damages claims, and the one-week
  duty to discharge a lien with an Acknowledgement of Payment are now there.

### Decisions: "strata" was never the whole net

- **The bare word `condominium` added 2,657 judgments** no strata phrase had reached, 672 of them
  from the 1990s. BC's pre-2000 regime was the *Condominium Act* and many of those judgments never
  use the word strata. The courts index goes 4,790 → **7,447**. This is the largest correction it
  has had. "Searched the obvious term to exhaustion" is not "searched exhaustively".
- **All seven CRT collections are now swept**, not the three that looked relevant. The four left
  over contributed 41 rows, only 3 of which mention the *Strata Property Act*. The reasoning for
  skipping them was sound; skipping them on reasoning alone was not.
- Two more silent parser faults, both caught by reconciling the parsed count against the site's own
  total rather than by reading code. `bcc_all.py` still keyed rows on the neutral citation, losing
  775 pre-1999 judgments while the page counter climbed. The CRT serves `/crt/abc/` for accident
  collections and writes `publicationDate`, so a lowercase pattern parsed all 41 rows as zero.
  **Reconciling counts has now caught every data-loss bug in this project. Reading the code has
  caught none of them.**
- **Provincial Court of BC is a hard stop**: every judgment link on its own site points at CanLII.
  Same shape as the BCHRT. Question 39 raised rather than worked around.
- Collection scripts moved to `decision-candidates/scripts/` with a README recording the faults.

### The answer to the question

`research/coverage.md`. The law we are permitted to hold is complete and currently frozen by the
BC Laws robots.txt block (question 24). The decisions are completely indexed — 11,286 rows — and
**zero of them can ship**, because no reuse permission exists for either body (questions 18, 19).
That permission is the single largest blocked asset in the project.
