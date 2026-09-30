# BylawIQ knowledge base

The shared knowledge BylawIQ answers from: British Columbia strata law, a starter kit for property management firms, a starter kit for buildings, plain-language topic guides, and the evals that prove answers are right.

This folder is self-contained. It has its own `package.json`, tooling and tests, nothing in it imports from the app, and the app reads only its built output. It can move to its own repository without changes (see the last section).

A building's own documents (its registered bylaws, minutes, plans) never live here. Those are uploaded in the app and isolated per building by row level security.

## The four layers

| Layer | What it holds | Folder | Item types |
|---|---|---|---|
| `law` | Acts, regulations, the Schedule of Standard Bylaws, CRT and court decisions | `law/` | `act-section`, `regulation-section`, `schedule`, `crt-decision`, `court-decision` |
| `firm` | Templates, policies, guidance and a legal tracker a firm adopts on day one | `firm-starter/` | `template`, `policy`, `guidance`, `tracker` |
| `building` | Standard bylaws, common bylaw patterns, onboarding checklist | `building-starter/` | `standard-bylaw`, `bylaw-pattern`, `checklist` |
| `topic` | Plain-language guides per topic, and evals | `topics/`, `evals/` | `topic-guide`, `eval` |

Law governs whether anything else is valid. Firm and building content cite law items; topic guides cite law, firm and building items and introduce no facts of their own.

## Folder map

```
kb/
  README.md                      this file
  package.json  tsconfig.json    kb tooling only (yaml, tsx, typescript, @types/node)
  taxonomy/topics.json           controlled topic vocabulary
  schema/frontmatter.schema.json item frontmatter schema (the validator reads it)
  law/bc/
    acts/<act>/                  one item per section, plus source.json
    regulations/<regulation>/    one item per section, plus source.json
    decisions/crt/               CRT decisions (facts, issue, holding, principle)
    decisions/courts/            BC Supreme Court and Court of Appeal decisions
  firm-starter/
    templates/ policies/ guidance/ legal-tracker/
  building-starter/
    standard-bylaws/ bylaw-patterns/ document-checklist.md
  topics/                        one guide per taxonomy topic
  evals/                         one eval file per topic
  research/                      plan, source register, licensing register, open questions (not shipped)
  tools/                         validate.ts, build.ts, lib/, tests
  dist/                          build output (git-ignored)
```

Every `.md` file under `law/`, `firm-starter/`, `building-starter/`, `topics/` and `evals/` is an item, except `README.md` files.

## Item format

Markdown with YAML frontmatter. All fields are required; use `null` where a field does not apply.

| Field | Meaning |
|---|---|
| `id` | Stable id, lower-case, dotted or kebab (`bc.spa.s135`, `topic.pets`). Never rename or reuse. |
| `layer` | `law`, `firm`, `building` or `topic`. Must match the folder. |
| `type` | One of the types allowed for the layer (table above). |
| `title` | Human title, sentence case. |
| `citation` | Legal citation. Required for law items, `null` otherwise. |
| `jurisdiction` | Two-letter code, `BC`. |
| `source_url` | Where the source lives. Required for law items. |
| `in_force_from` / `in_force_to` | `YYYY-MM-DD`. For decisions, `in_force_from` is the decision date. `in_force_to` is `null` while in force. |
| `retrieved_at` | `YYYY-MM-DD` the source was fetched. Required for law items. |
| `licence` | An id from `research/licensing-register.md`. |
| `topics` | Ids from `taxonomy/topics.json`. |
| `cites` | Ids of other kb items this one relies on. Must resolve. |
| `supersedes` | Id of the item this replaces (for a new version of a section), or `null`. |
| `status` | `draft`, `reviewed` or `approved`. |
| `reviewed_by` / `reviewed_at` | Who signed off and when. Required for `approved`. |
| `notes` | Free text for reviewers, or `null`. |

Each act and regulation folder also has a `source.json`: `title`, `citation`, `chapter`, `url`, `consolidation_date`, `licence`, `retrieved_at`, `parts[]`. Both dates are required once the folder contains an item.

### Full example

This shows the shape of a law item. The title, dates, reviewer and body are illustrative placeholders, not verified facts or statute text.

```markdown
---
id: bc.spa.s135
layer: law
type: act-section
title: "[Section heading exactly as it appears in the Act]"
citation: "Strata Property Act, SBC 1998, c 43, s 135"
jurisdiction: BC
source_url: https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/98043_01
in_force_from: 2000-07-01
in_force_to: null
retrieved_at: 2026-10-01
licence: bc-kings-printer
topics: [bylaw-enforcement-s135, fines, hearings]
cites: [bc.spa.s34-1]
supersedes: null
status: reviewed
reviewed_by: "J. Researcher, legal researcher"
reviewed_at: 2026-10-02
notes: null
---

# Section 135

## (1)

[Text or structured summary of subsection (1), as the licence allows.]

## (2)

[Text or structured summary of subsection (2).]
```

Headings matter: the build splits items into chunks on headings first, then paragraphs, and records the heading path as `section_ref` (for example `Section 135 > (1)`). Put each subsection, standard bylaw or decision part (Facts, Issue, Holding, Principle) under its own heading.

## Review workflow

1. **draft.** Anyone can add or change an item. Drafts ship to the demo build only.
2. **reviewed.** A legal researcher has checked the item against its source (law) or its cited items (everything else). Record `reviewed_by` and `reviewed_at`.
3. **approved.** Final sign-off. Only approved items ship to production (`pnpm build:prod`).

Counsel (a BC-licensed lawyer) must approve firm templates, policies and guidance, and topic guides, because they give advice or are sent to owners. Until then their `notes` say `needs counsel review`. Law items need a legal researcher's review and counsel spot checks (see `research/plan.md`).

A production item that cites a non-approved item gets a warning: the cited item will be missing from the production build.

## Licensing rule

Every law item has a `licence` from `research/licensing-register.md`, and the validator rejects any licence not in that table. Store verbatim text only where that licence allows it. Otherwise write a structured summary in our own words and link to the source in `source_url`. CanLII is link-only: never scrape or copy it. Until a licence row is marked verified, use the summary-and-link path.

Never write statute text, section numbers or holdings from memory. Every law item is checked against its source.

## Commands

```sh
pnpm install --dir kb      # kb has its own dependencies; it is not an app workspace
pnpm --dir kb validate     # check every item; exit 1 on errors
pnpm --dir kb build        # demo build, drafts included
pnpm --dir kb build:prod   # production build, approved items only
pnpm --dir kb test         # validator and chunker tests
pnpm --dir kb typecheck
```

The build writes:

- `dist/manifest.json`: kb version (from `package.json`), build time, status filter, corpus hash, counts by layer, status and type, and an index of every item.
- `dist/corpus.jsonl`: one line per retrievable item with its frontmatter, `path`, `body` and `chunks[]` (`chunk_id`, `section_ref`, `heading`, `content`, each at most about 1,200 characters).
- `dist/evals.jsonl`: eval items. They are kept out of the corpus so expected answers can never be retrieved.

Bump `version` in `package.json` on every content change: minor for new items, patch for fixes. The app uses it as the corpus version.

## How the app consumes it

The app never imports from `kb/`. It reads the built output from the directory in the `KB_DIST_DIR` environment variable (default in `.env.example`: `kb/dist`).

`scripts/ingest-kb.ts` in the app reads `${KB_DIST_DIR}/corpus.jsonl` and `manifest.json` and loads law items into `legal_sources` and `legal_chunks`. It is a dry run by default and prints what it would load. `--apply` writes to the database with the service-role key. It is an admin command-line tool, never reachable from user input, and the legal corpus it writes is shared and read-only to users, so it does not touch building-scoped data.

## Moving kb/ to its own repository

1. Copy the folder, or keep history with `git subtree split --prefix=kb -b kb-only` and push that branch to the new repository.
2. In the new repository, run `pnpm install` and `pnpm test && pnpm validate && pnpm build`. Nothing needs changing: paths resolve from the tools' own location.
3. Publish `dist/` somewhere the app can read it (a release artifact, a package, or a checkout in CI).
4. In the app, point `KB_DIST_DIR` at that location and delete `kb/`.
