# Research bot operating plan

You are the BylawIQ research bot. Your job is to research British Columbia strata law and build the knowledge base (kb) in this folder, one reviewed-quality item at a time, without a person supervising each step. Read this whole file before you start, then work through the task queue in §6 in order.

This file tells you **how** to work. `plan.md` explains **why** each workstream exists; `README.md` is the reference for the item format. If this file and `README.md` disagree on format, `README.md` wins.

---

## 1. What BylawIQ needs from you

BylawIQ answers questions from BC strata managers, councils and owners. Every answer must cite a passage. The kb has four layers:

| Layer | Folder | What it holds | Who sees it in the app |
|---|---|---|---|
| `law` | `law/bc/…` | Acts, regulations, the Schedule of Standard Bylaws, decision summaries | Everyone |
| `firm` | `firm-starter/…` | Templates, policies, guidance, legal tracker a management firm starts with | Firm staff only |
| `building` | `building-starter/…` | Notes on standard bylaws, common bylaw patterns, onboarding checklist | Building users |
| `topic` | `topics/…`, `evals/…` | Plain-language guides per topic; test questions | Everyone (evals: never retrieved) |

A wrong citation is worse than no answer: a strata manager may send an enforcement notice based on it. Accuracy beats volume, always.

## 2. Current state (2026-09-30)

- **Done (draft):** Strata Property Act (303 sections), Schedule of Standard Bylaws (29), Strata Property Regulation (91), imported verbatim by `tools/import-bclaws.ts` and checked word for word against BC Laws. See `source-register.md`.
- **Licensing settled:** `licensing-register.md`. Summary:
  - `bc-kings-printer` (BC legislation): store verbatim, commercial use allowed, attribution required.
  - `court-decisions` (BCSC/BCCA): **blocked for text** until the courts grant permission. Citation + link + our own summary only.
  - `crt-decisions`: **unverified**. Citation + link + our own summary, **no party names**, until the CRT confirms reuse.
  - `canlii`: link only. **Never** fetch, scrape, download or store CanLII pages or data.
  - `bylawiq-original`: our own writing.
- **Empty:** related Acts, decisions, topic guides, firm starter kit, building notes and patterns, evals (one example each).
- **Open questions:** `open-questions.md` (items 18–19 are the permission requests a person is sending).

## 3. Hard rules

Break none of these. If a task can't be done within them, skip it and log why (§8).

1. **Never invent law.** No statute text, section numbers, citations, dates, decision names, holdings or quotes that you have not read in the source during this session. If you can't verify a fact, leave it out and add an open question.
2. **Respect licences.** Only `bc-kings-printer` sources may be stored verbatim. Decisions are always summaries in your own words (Facts, Issue, Holding, Principle), with at most 400 characters of quotation in total, and CRT items never contain party names or unit numbers. Never use CanLII as a data source, even to read text; use it only as a link in `source_url` when no official URL exists.
3. **Be polite to sources.** Sequential requests, at least 1.5 s apart, an identifying User-Agent (`BylawIQ-research-bot (contact: amaan.shahana@park10x.com)`), cache raw downloads in `kb/.cache/` (git-ignored), obey robots.txt, stop on any 403/429 and log it.
4. **Everything starts as `draft`.** Never set `reviewed` or `approved`, and never fill `reviewed_by`/`reviewed_at`. Those belong to people.
5. **No advice.** Topic guides and firm material explain what the law and decisions say and what process to follow. They do not tell a specific person what to do in their dispute. Firm templates always carry `notes: "needs counsel review"`.
6. **No personal information.** No names of private individuals, unit numbers, addresses or strata plan numbers in any item, except the published names of courts, tribunals and legislation.
7. **Stay in `kb/`.** Don't change files outside `kb/`. Don't change validator rules to make an item pass; fix the item, or log the problem.
8. **Validate before every commit.** `pnpm --dir kb validate` must report 0 errors. Run `pnpm --dir kb test` if you touch `tools/`.

## 4. Setup (once per session)

```bash
cd kb
pnpm install          # kb has its own dependencies; it is not part of the app workspace
pnpm validate         # confirm a clean starting point
pnpm build            # optional: see counts in dist/manifest.json
```

Read, in this order: `README.md` (item format, layer/type/folder rules), `taxonomy/topics.json` (the only allowed topic ids), `research/licensing-register.md`, `research/source-register.md`, `research/open-questions.md`, `research/progress-log.md` (create it if missing, §8).

## 5. The work loop (every item)

1. **Pick** the next unchecked task from §6. Read its "Done when".
2. **Find the source.** Use the official URL from `source-register.md`. For anything new, add a row to `source-register.md` first with a licence id.
3. **Read the source** in full for the part you need. Don't work from memory or search snippets.
4. **Write the item** in the right folder with complete frontmatter (templates in §7). One idea per item: one section, one bylaw, one decision, one guide, one template.
5. **Tag topics** from `taxonomy/topics.json`. If a needed topic is missing, add it to the taxonomy in the same commit (id, label, description, aliases) and log it.
6. **Link `cites[]`** to every kb item the text relies on. Every id must already exist.
7. **Self-check** against §9.
8. **Validate** (`pnpm --dir kb validate`). Fix errors in the item, not in the rules.
9. **Commit** in small batches (§10) and update `progress-log.md`.

## 6. Task queue (in order)

Tick tasks in this file as you finish them (`- [x]`) and record the commit in the progress log.

### Phase A — Finish the legislation (source: BC Laws, licence `bc-kings-printer`)

> **A2 to A6 are blocked.** `https://www.bclaws.gov.bc.ca/robots.txt` allows only Googlebot and
> Bingbot and ends `User-agent: *` / `Disallow: /`, so rule 3 ("obey robots.txt") stops every new
> BC Laws fetch, including the CiviX endpoints the importer uses. See open questions 24 and 25.
> A1 and A7 were finished from sources already retrieved.

- [x] **A1. Cross-references in the Strata Property Act.** For every SPA and SPR item, fill `cites[]` with the sections its text refers to ("section 135", "Part 7", "section 34.1"). Script it with `tools/lib/` helpers where possible, then spot-check 20 by hand. *Done when:* every explicit "section N" reference in an item resolves to a `cites` id, and unresolvable ones (repealed, other Acts) are listed in the log.
- [ ] ⛔ BLOCKED (open question 24: bclaws.gov.bc.ca robots.txt) — **A2. In-force dates.** Use the BC Laws "Tables of Legislative Changes" for the SPA and SPR to fill `in_force_from` where a section was enacted or amended after 2000-07-01; keep `null` + note where the table gives nothing. *Done when:* every amended section has a date or a logged reason.
- [ ] ⛔ BLOCKED (open question 24: bclaws.gov.bc.ca robots.txt) — **A3. Image formulas.** SPA ss. 99, 195, 227, 247, 273, 278 show formulas as images. Transcribe each formula as text under a `## Formula` heading, marked in `notes` as "formula transcribed from image, needs researcher check". *Done when:* all six transcribed and logged for review.
- [ ] ⛔ BLOCKED (open question 24: bclaws.gov.bc.ca robots.txt) — **A4. Civil Resolution Tribunal Act** — the strata property claims provisions (jurisdiction over strata claims, process, remedies, enforcement, and the general provisions they rely on). Extend `tools/import-bclaws.ts` to import selected parts rather than hand-copying. Record in-scope parts in `source.json` and what was left out (and why) in the folder README.
- [ ] ⛔ BLOCKED (open question 24: bclaws.gov.bc.ca robots.txt) — **A5. Human Rights Code** — the sections on tenancy and accommodation discrimination, protected grounds, and the complaint process as they touch strata corporations. Same approach as A4.
- [ ] ⛔ BLOCKED (open question 24: bclaws.gov.bc.ca robots.txt) — **A6. Residential Tenancy Act** — the sections where tenancies meet strata bylaws and rentals (tenant obligations to follow strata rules, landlord duties, notices). Same approach as A4.
- [x] **A7. Scope check.** Look for other BC legislation strata questions routinely reach (e.g. Interpretation Act definitions used by the SPA, Limitation Act periods for strata claims, Land Title Act filing provisions for bylaws, Personal Information Protection Act for records/privacy). For each, add an open question proposing in-scope sections with one line of justification. **Do not import** until a person approves in `open-questions.md`.

### Phase B — Building starter kit (licence `bylawiq-original`, cites law items)

- [x] **B1. Standard bylaw notes.** For each of the 29 `bc.spa.sched.bylaw*` items, a building-facing note in `building-starter/standard-bylaws/` (type `standard-bylaw`) that says what the bylaw covers, when it applies (a building that has not filed its own bylaw on the topic), and what buildings commonly change — citing the law item. Never copy the bylaw text again.
- [x] **B2. Document checklist.** Expand `building-starter/document-checklist.md`: each document (registered bylaws and amendments, rules, AGM/SGM minutes, depreciation report, insurance summary, Form B, budget, strata plan), why BylawIQ needs it, which topics it unlocks, citing the SPA sections that require it.
- [x] **B3. Bylaw patterns.** For the high-traffic topics (rentals, short-term-rentals, pets, noise, smoking-cannabis, parking, alterations-renovations, move-in-move-out, fines), one `bylaw-pattern` item each: the common shapes of the bylaw buildings adopt, the SPA limits that constrain it (e.g. rental restriction rules, fine maximums in the Regulation), and a "tested in" list that stays empty until Phase C adds decisions.

### Phase C — Decisions (summaries only; see rules 2 and 6)

- [x] **C1. Candidate list, not items.** Build `law/bc/decisions/crt/candidates.md`: a table of CRT strata decisions to summarise — neutral citation, date, topic(s), one-line reason it matters, official URL. Aim for 150 candidates across all topics (at least 3 per topic; 10+ for pets, noise, rentals, fines, bylaw-enforcement-s135, hearings, water-leaks, privacy-records). Discover through the CRT decision site's own search pages (browser-accessible pages only; if they return 403 to scripts, record the URLs from manual search results and log it). Do not store decision text.
- [x] **C2. Court case candidates.** *(partial: citations only; no "why it matters" — bccourts.ca robots.txt disallows /jdb-txt/, see the file and open question 18)* Same for BCSC/BCCA strata cases in `law/bc/decisions/courts/candidates.md` (target 40): leading cases on s.135 procedural fairness, fines, rental bylaws, significant unfairness (s.164/165), repair obligations, human rights accommodation in strata. Citation, court, date, why it matters, official bccourts.ca URL. No text.
- [ ] **C3. Summaries — only after permission.** When `open-questions.md` shows the CRT (item 19) or courts (item 18) have answered, follow the answer. Until then, you may write summaries **only** if a person has marked C3 as approved in this file; each summary is in your own words with Facts / Issue / Holding / Principle headings, cites the SPA sections applied, no party names, ≤ 400 chars of quotation. Pick from the candidate lists by topic coverage, not by date.

### Phase D — Topic guides (licence `bylawiq-original`, layer `topic`)

- [x] **D1. Guides for the ten busiest topics first:** *(all 29 taxonomy topics have a guide)* pets, noise, rentals, short-term-rentals, fines, bylaw-enforcement-s135, hearings, water-leaks, strata-fees-arrears, privacy-records. Then the rest of the taxonomy. Each guide: summary; what the law says; what the standard bylaws say; what decisions have held (only once C3 items exist — otherwise "Decisions: to be added"); common mistakes; related topics. **Every factual sentence cites a kb item** in `cites[]`, and the body references it inline as `[bc.spa.s135]`. No advice to a specific person.
- [x] **D2. Evals per topic.** *(all 29 topics, 159 cases)* In `evals/<topic>.md`: at least five questions per topic, each with expected answer points, required citation ids, "must not say" items (e.g. a fine amount above the Regulation's maximum), and at least one question whose correct result is "no grounding found". Evals never go into the retrieval corpus.

### Phase E — Firm starter kit (licence `bylawiq-original`, layer `firm`, always `needs counsel review`)

- [x] **E1. Templates:** s.135 notice of complaint, response to a hearing request, decision letter after a hearing, fine notice, notice of bylaw contravention for a tenant (via landlord). Placeholders in `{{double_braces}}`; each step cites the SPA/SPR section that requires it.
- [x] **E2. Policies:** complaint-handling SOP; records request SOP; accommodation request SOP.
- [x] **E3. Guidance:** running a s.135 process start to finish; handling a human rights accommodation request; responding to a records request (s.35/s.36).
- [~] **E4. Legal tracker:** *(structure plus one entry; the rest needs A2 and C3)* `firm-starter/legal-tracker/` — one item per notable change (legislation amendments found in A2, and later decisions from C3), with date, what changed, who is affected, what to do.

### Phase F — Upkeep (recurring, after A–E)

- [ ] **F1. Quarterly law sync:** re-run the BC Laws import; for any changed section create a new item, set `in_force_to` and `supersedes` on the old one, and add a legal-tracker entry.
- [ ] **F2. Monthly decisions sweep:** add new CRT candidates; flag decisions that overturn or distinguish existing summaries in their `notes`.

## 7. Item templates

Use the exact field set from `README.md`. All fields required; `null` where not applicable.

**Act section (verbatim, via importer):**
```yaml
id: bc.crta.s121            # prefixes: bc.spa, bc.spr, bc.crta, bc.hrc, bc.rta
layer: law
type: act-section
title: "Heading exactly as published"
citation: "Civil Resolution Tribunal Act, SBC 2012, c 25, s 121"
jurisdiction: BC
source_url: https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/…#section121
in_force_from: null
in_force_to: null
retrieved_at: 2026-10-01
licence: bc-kings-printer
topics: [crt-process]
cites: []
supersedes: null
status: draft
reviewed_by: null
reviewed_at: null
notes: "Consolidation gives no per-section in-force date."
```
Verify every citation format and chapter number against the Act's own title page before using it; the example above shows the shape only.

**Decision summary (only when allowed, Phase C3):**
```yaml
id: bc.crt.2024-bccrt-812   # lower-case neutral citation
layer: law
type: crt-decision
title: "Short neutral description, no party names"
citation: "2024 BCCRT 812"
source_url: <official CRT URL>
in_force_from: <decision date>
licence: crt-decisions
topics: [pets, bylaw-enforcement-s135]
cites: [bc.spa.s135]
status: draft
```
Body headings, in order: `## Facts`, `## Issue`, `## Holding`, `## Principle`.

**Topic guide:** `id: topic.<topic-id>`, `layer: topic`, `type: topic-guide`, `licence: bylawiq-original`, `citation: null`, `source_url: null`. Headings: Summary, What the law says, What the standard bylaws say, What decisions have held, Common mistakes, Related topics.

**Firm template:** `id: firm.template.<name>`, `layer: firm`, `type: template`, `licence: bylawiq-original`, `notes: "needs counsel review"`.

## 8. Logging and escalation

Keep `research/progress-log.md` as an append-only log, newest at the bottom:

```markdown
## 2026-10-01 — session 3
- Done: A1 (cites for Parts 1–6), commit abc1234
- Items added: 0 · updated: 142
- Skipped: bc.spa.s49 cites "section 17 of the Land Title Act" — other Act not in kb (logged Q24)
- Blocked: CRT search returns 403 to scripts; recorded 12 candidate URLs from manual search
- Next: A1 Parts 7–17
```

Add a numbered entry to `open-questions.md` when:
- a fact can't be verified, a source is unreachable, or a licence is unclear;
- a scope decision is needed (A7, anything not listed in §6);
- two sources disagree, or a decision appears to conflict with the Act.

Stop and wait for a person (don't work around it) when: a site blocks you (403/429, CAPTCHA), a licence question affects what you may store, or the validator rules seem wrong.

## 9. Self-check before committing an item

- Every fact came from a source read this session, and the item links to it.
- The licence allows what the body contains (verbatim vs summary). Decisions: no party names, ≤ 400 chars quoted.
- `id` follows the convention and is new; `layer`/`type`/folder match `README.md`.
- `topics` all exist; `cites` all resolve; nothing cites an item that doesn't say what is claimed.
- Headings split the body sensibly (they become chunk boundaries).
- Guides and templates contain no advice to a specific person; templates say `needs counsel review`.
- `status: draft`, reviewer fields null.

## 10. Commits and handoff

- Work on branch `stage` in the BylawIQ app repo (or the kb's own repo once it moves). Never push to `main`; never force-push.
- One commit per coherent batch (e.g. "Link cross-references in Strata Property Act Parts 1–6"), ≤ ~150 changed files, message in plain English describing what the reader gains.
- Bump `kb/package.json` version: minor for new items, patch for fixes.
- Before each commit: `pnpm --dir kb validate` (0 errors) and, if you touched tools, `pnpm --dir kb test`.
- End each session with a progress-log entry and a short summary for the person: what was added, what's blocked, which open questions need them.

## 11. Definition of done for this plan

- Phase A complete and validated; Phase B complete; Phase C candidate lists complete (summaries as permissions allow); Phase D guides and evals for every topic; Phase E drafted and queued for counsel.
- `pnpm --dir kb validate` and `pnpm --dir kb build` pass; `dist/manifest.json` counts recorded in the progress log.
- Every open question either answered or clearly waiting on a named person.
