# Research plan

This is the plan for filling the knowledge base. Work runs roughly in order: R1 unblocks R2 to R4, and R5 to R7 depend on the law items they cite. Every workstream writes items in the format described in `kb/README.md` and starts them at `status: draft`.

Rules that apply to every workstream:

- Never invent statute text, section numbers, decision citations or holdings. If a fact cannot be checked against the source, leave it out and add a question to `open-questions.md`.
- Every law item has `source_url`, `retrieved_at`, `citation`, `in_force_from` and a `licence` from `licensing-register.md`.
- Copy text verbatim only where the licence allows it. Otherwise write a structured summary in our own words and link to the source.
- Tag every item with topics from `taxonomy/topics.json`. If a topic is missing, add it to the taxonomy in the same change.
- Run `pnpm --dir kb validate` before opening a change.

Reviewer shorthand: **Legal researcher** checks accuracy against the source. **Counsel** is a BC-licensed lawyer who signs off on anything that gives advice or will be sent to an owner. **Product** checks usefulness and wording.

---

## R1. Licensing

- **Goal:** know, for every source we plan to use, whether we may store verbatim text, what attribution is required, and whether commercial use is allowed.
- **Sources:** BC Laws (King's Printer) copyright and licence terms; Civil Resolution Tribunal website terms and decision reuse policy; BC courts judgment reproduction policy; CanLII terms of use.
- **Output:** `research/licensing-register.md` (one row per licence id, every "To verify" replaced), answers moved to the answered section of `open-questions.md`, and `source-register.md` statuses updated.
- **Done when:** every licence id has verified terms, a link to the licence text, and a date checked; each source in `source-register.md` has a licence id whose status is Verified.
- **Reviewed by:** counsel.

## R2. Strata Property Act, Strata Property Regulation, Schedule of Standard Bylaws

- **Goal:** one item per section of the Act and Regulation, and one per standard bylaw, current to the latest consolidation, with point-in-time history for sections that changed recently.
- **Sources:** BC Laws consolidations (see `source-register.md`).
- **Output:** `law/bc/acts/strata-property-act/` (type `act-section`, and `schedule` for the Schedule of Standard Bylaws), `law/bc/regulations/strata-property-regulation/` (type `regulation-section`). Complete `source.json` in each folder, including `consolidation_date`, `retrieved_at` and `parts[]`. Ids follow `bc.spa.s135`, `bc.spa.s135.1` style, `bc.spr.s7.1`, `bc.spa.sched.bylaw3`.
- **Status (2026-09-30):** imported verbatim as drafts by `tools/import-bclaws.ts` (Act 303 sections, 29 standard bylaws, Regulation 91 sections), each section checked word for word against the BC Laws page by script. Remaining: `cites[]`, `in_force_from` from the Tables of Legislative Changes, transcription of the Act's six image formulas, the Regulation's forms, and the researcher review and 10% counsel spot check.
- **Done when:** every section in each Part listed in `source.json` has an item; `cites[]` link sections that cross-reference each other; validation passes; a spot check of 10% of items against the source finds no discrepancies.
- **Reviewed by:** legal researcher (every item), counsel (spot check).

## R3. Related Acts

- **Goal:** the parts of other Acts that strata questions routinely reach.
  - *Human Rights Code*: discrimination in tenancy and accommodation provisions, duty to accommodate as it applies to strata corporations (disability, family status, age).
  - *Residential Tenancy Act*: where it overlaps with strata bylaws and rentals (tenant obligations to follow bylaws, landlord and strata interaction).
  - *Civil Resolution Tribunal Act*: strata property claims, jurisdiction, process, remedies, enforcement.
- **Sources:** BC Laws consolidations (see `source-register.md`).
- **Output:** `law/bc/acts/human-rights-code/`, `law/bc/acts/residential-tenancy-act/`, `law/bc/acts/civil-resolution-tribunal-act/`, each with a completed `source.json` whose `parts[]` records which parts are in scope.
- **Done when:** the in-scope sections listed in each `source.json` all have items, tagged to topics; a written note in each folder README explains what was left out and why.
- **Reviewed by:** legal researcher, counsel (scope decision).

## R4. Decisions

- **Goal:** 50 to 100 CRT strata property decisions spread across the taxonomy (aim for at least two per topic, more for pets, noise, rentals, fines, s.135 enforcement, hearings, water leaks and records), plus the key BC Supreme Court and Court of Appeal strata cases.
- **Sources:** CRT decision database, BC courts judgments, CanLII for discovery and links only (see `licensing-register.md`).
- **Output:** `law/bc/decisions/crt/` (type `crt-decision`) and `law/bc/decisions/courts/` (type `court-decision`). Each decision item has sections **Facts**, **Issue**, **Holding**, **Principle**, and `cites[]` to the Act sections it applies. `in_force_from` is the decision date. Ids follow `bc.crt.2024-bccrt-812` style (neutral citation, lower-case).
- **Done when:** the target count is reached with topic coverage recorded in a table in `law/bc/decisions/crt/README.md`; every holding and principle has been checked against the decision text; any decision later overturned or distinguished is marked in `notes`.
- **Reviewed by:** legal researcher (every item), counsel (principles for the top 20 most-cited decisions).

## R5. Topic guides

- **Goal:** one plain-language guide per taxonomy topic that explains how the law, standard bylaws and leading decisions fit together, and what a strata manager should do.
- **Sources:** R2 to R4 items only. A topic guide cites kb items; it does not introduce facts that are not in them.
- **Output:** `topics/<topic-id>.md` (type `topic-guide`, layer `topic`, licence `bylawiq-original`). Sections: summary, what the law says, what the standard bylaws say, what decisions have held, common mistakes, related topics.
- **Done when:** every topic has a guide; every factual statement cites a kb item; validation passes with no unresolved cites.
- **Reviewed by:** counsel (required before `approved`), product (wording).

## R6. Firm starter kit

- **Goal:** templates and guidance a property management firm can adopt on day one.
  - Templates: s.135 notice of complaint, response to a hearing request, decision letter after a hearing, fine notice.
  - Policies: complaint handling standard operating procedure.
  - Guidance: how to run a s.135 process, how to handle an accommodation request, records requests.
  - Legal tracker: a register of recent law changes and decisions firms should know about.
- **Sources:** R2 to R5 items.
- **Output:** `firm-starter/templates/`, `firm-starter/policies/`, `firm-starter/guidance/`, `firm-starter/legal-tracker/`. Every template's `notes` says `needs counsel review` until counsel signs off.
- **Done when:** each listed template and policy exists, cites the sections it relies on, and has been reviewed by counsel.
- **Reviewed by:** counsel (required, these are sent to owners), product.

## R7. Building starter kit

- **Goal:** what a building needs to get useful answers on day one.
- **Sources:** R2 (Schedule of Standard Bylaws), common bylaw patterns seen in registered bylaws.
- **Output:** `building-starter/standard-bylaws/` (type `standard-bylaw`: building-facing notes that cite the law-layer `bc.spa.sched.bylaw*` item; the verbatim text stays in the law layer and is not duplicated), `building-starter/bylaw-patterns/` (type `bylaw-pattern`, common amendments such as rental restrictions, pet limits, short-term rental bans, with the decisions that tested them), `building-starter/document-checklist.md` (documents to upload and why).
- **Done when:** every standard bylaw a building commonly relies on has a building-facing note citing its law item; at least one pattern per high-traffic topic; the checklist has been used on two real onboarding calls and updated.
- **Reviewed by:** legal researcher, counsel (bylaw patterns), product (checklist).

## R8. Evals and upkeep

- **Goal:** prove the kb answers real questions correctly, and keep it current.
- **Evals:** `evals/<topic-id>.md` (type `eval`) with question, expected answer points, required citations (kb ids), and must-not-say items. At least five questions per topic, including one where the correct output is "no grounding found". Evals are built into `dist/evals.jsonl` and never into the retrieval corpus.
- **Upkeep cadence:**
  - Quarterly: sync every Act and Regulation against the current BC Laws consolidation. Update `retrieved_at` and `consolidation_date`; for changed sections, create a new item and set `in_force_to` and `supersedes`.
  - Monthly: review new CRT strata decisions and add those that change or sharpen a principle; update `firm-starter/legal-tracker/`.
  - On every change: bump `kb/package.json` version (minor for new items, patch for fixes), run validate and build.
- **Done when:** evals exist for every topic and pass at the agreed threshold; the cadence has an owner and a calendar entry.
- **Reviewed by:** counsel (expected answers), engineering (harness).
