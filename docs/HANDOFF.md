# BylawIQ — developer handover

Status as of 6 October 2026. Read this first, then `AGENTS.md` (the rules) and the spec for the area you're
working in (`docs/00`–`11`).

## Where things stand

- **There is no live database yet.** The app runs today as the interactive demo at `/demo`: five sample people,
  four sample buildings, an in-memory store per browser session, no model calls. Everything you can click in the
  demo is the product as designed.
- **The real (Supabase) app is wired up but not connected.** Auth, server actions, route handlers, RLS
  migrations, retrieval, streaming and ingestion are written and unit-tested; none of it has run against a live
  project with real credentials. Without `NEXT_PUBLIC_SUPABASE_URL` the real routes send people to `/login`,
  which explains that setup is required.
- **The knowledge base (`kb/`) is complete as drafts.** 564 items (the Strata Property Act, Regulation, the 27
  prescribed forms, standard bylaws, 31 topic guides, firm and building starter kits), all `status: draft`,
  awaiting counsel review. It is not yet loaded anywhere — see [Knowledge base](#knowledge-base).

## Run it

```sh
npm ci
cp .env.example .env.local      # then set DEMO_MODE=on
npm run dev                     # http://localhost:3000/demo
```

Checks (all must pass — CI runs the same):

```sh
npm run format:check && npm run typecheck && npm run lint && npm test
npm run build
E2E_START=1 E2E_PORT=3107 DEMO_MODE=on npm run test:e2e   # serves the production build
```

## How the code is organized

The UI, the screens and the data are three separate layers. The point of the split: **connecting the database
means implementing one adapter (`data/supabase.ts`) — no page or UI component changes.**

```
app/(app)/…, app/demo/…   Route files. One line each: pick a data source, render a screen.
app/_screens/             The screens. Written once against the DataSource contract; decide which view to show.
features/*/components/    Presentational UI. Plain props in, no fetching. Restyle or rebuild freely.
components/               Shared shell and primitives (ui.tsx), and the client-side write seam (backend.tsx).
app/globals.css           All styling and design tokens.
data/source.ts            The DataSource contract: every read a screen can make.
data/supabase.ts          Real adapter → features/*/queries.ts (runs as the user, behind RLS).
mock/data-source.ts       Demo adapter → the in-memory store (mock/rules.ts mirrors each RLS policy).
features/*/actions.ts     Real server actions (writes).   mock/actions.ts — the demo's, same signatures.
features/*/queries.ts     Real reads.                      mock/source.ts — the demo's, same shapes.
lib/                      Shared utilities: auth guards, errors, env, AI, security, exports, column map.
inngest/                  Background document ingestion.
supabase/                 Migrations and pgTAP tests.
kb/                       The knowledge base package (its own tooling; Node 24, pnpm).
scripts/ingest-kb.ts      Loads kb/dist into legal_sources / legal_chunks (`npm run kb:ingest`).
```

Reads and writes have matching seams:

| | Contract | Real | Demo | Chosen by |
| --- | --- | --- | --- | --- |
| Reads (server) | `data/source.ts` `DataSource` | `data/supabase.ts` | `mock/data-source.ts` | the route file |
| Writes (client) | `components/backend.tsx` `Backend` | real server actions (the default) | `mock/actions.ts` | `app/demo/layout.tsx` |

Two fences keep this honest:

- `tests/mock/boundary.test.ts` fails if anything outside `mock/`, `app/demo/`, `app/api/demo/` or `tests/`
  imports the mock. The screens and UI never know which source they're on.
- `lib/resources.ts` is the single table/column map both sources project to, so the demo can't show a column
  the real query wouldn't return. TypeScript checks both adapters against the same `DataSource` types.

### Changing the UI

Components in `features/*/components/` receive already-scoped data as props and never fetch, so they can be
redesigned without touching data code. Their prop types live next to them (`features/dashboards/types.ts`,
`features/residents/types.ts`, `features/knowledge/types.ts`) — those types *are* the contract the data layer
fills. Links are built from `useBackend().base` so the same component works under `/demo`. Design tokens and
writing rules are in `docs/06-DESIGN-SYSTEM.md` (§7: sentence case; uppercase labels come from CSS).

## Connecting the database

1. Create the Supabase project, set the variables in `.env.example`, and apply `supabase/migrations/` in
   filename order. Configure Auth (site URL, redirects, email, the custom access-token hook in the identity
   migration) and register `/api/inngest`. `npm run test:db` runs the pgTAP isolation tests.
2. The core screens then work as they are: workspace, building sections, Ask, conversations, documents,
   bylaws, notices, disputes, members, settings, firm links and review.
3. Each feature below exists only in the demo. `data/supabase.ts` returns `null` for it, so the real app shows
   the plain view instead. To ship one: write the migration **and** its pgTAP test proving Building A can't
   read Building B's rows (AGENTS.md §4), add the query in `features/<name>/queries.ts`, return it from the
   adapter method. The demo implementation shows the exact shape and scoping rule.

| Feature | Adapter method | Demo implementation | Needs |
| --- | --- | --- | --- |
| Firm owner / strata manager dashboards | `workspaceDashboard` | `mock/dashboards.ts` | Aggregation queries or views over existing tables; plans/seats data |
| Building manager home | `buildingDashboard` | `mock/dashboards.ts` | Same; residents count and code |
| Platform admin console | `isPlatformAdmin`, `platformDashboard` | `mock/dashboards.ts` | `platform_admin` JWT claim; plans, usage and feature-flag tables |
| Resident home and paid tools | `residentHome` | `mock/residents.ts` | Wallets, ledger, resident drafts, alerts tables; payments; the `chat.resident` permission. **TODO(legal): resident AI needs legal sign-off first.** |
| Firm knowledge (Knowledge → Firm tab, firm layer in answers) | `firmKnowledge`, `layers`, `askHome` | `mock/mutations/firm-knowledge.ts`, `mock/answers.ts` | `firm_documents` / `firm_chunks` tables with org-scoped RLS; a `firm` value for `message_citations.kind` |
| Knowledge-layer chips in Ask | `layers`, `askHome` | `mock/rules.ts#layersFor` | A layer filter in `features/chat/retrieval.ts` |

The matching write actions (`buyCredits`, `residentDraft`, `saveFirmDoc`, `deleteFirmDoc`, `setFlag`) return
"not available yet" in the real `Backend` (`components/backend.tsx`) until their server actions exist.

## Knowledge base

`kb/` is a standalone package (`cd kb && pnpm install`, Node 24). `pnpm validate` checks every item against
the schema, taxonomy and licence register; `pnpm build` writes `kb/dist/` (git-ignored): `manifest.json`,
`corpus.jsonl`, `evals.jsonl`. `kb/README.md` covers the format and tools.

- **Status:** 564 items validate with 0 errors; 123 tool tests pass. Every item is a draft. `pnpm build:prod`
  includes approved items only, so a production build is currently empty until counsel signs items off.
- **Loading:** `npm run kb:ingest` (dry run) prints what would load: 450 law items — 303 statute, 118 regulation
  (91 sections + 27 forms), 29 standard bylaws — 1,203 chunks. `--apply` writes `legal_sources` /
  `legal_chunks` (needs the service key, `VOYAGE_API_KEY` and `LEGAL_CORPUS_INGEST_ENABLED=true`; refuses draft
  builds in production). Firm, building and topic items are not loaded by anything yet (open question 7 in
  `kb/research/open-questions.md`).
- **The demo does not read `kb/`.** Its legal layer (`mock/data/legal.ts`) is short hand-written paraphrase and
  its CRT decisions are fictional, by design. Swapping in kb content would be a reasonable next step.
- **Before production:** the King's Printer attribution that `kb/README.md` says the app displays is not shown
  anywhere yet; CRT and court decision licensing is unresolved (`kb/research/licensing-register.md`), so the
  decision folders are empty; `kb/tools/import-bclaws.ts` still fetches from BC Laws unless run with
  `--offline` (the robots.txt stop is a documented policy, not enforced in code).

## Changes in this handover pass

- Formatted the app with Prettier (`npm run format`); CI now checks formatting. `kb/` keeps its own style.
- Replaced the two parallel page trees with shared screens over the `DataSource` contract (above). Every demo
  route now has a real twin (`/admin` is new; until the console exists it sends everyone to their own home).
- Removed cross-feature imports (AGENTS.md §3): row helper to `lib/rows.ts`; the members account-link panel is
  now passed into `Resources` by the screen.
- Fixed: a demo portfolio chat stayed readable after losing one of its buildings (the mock skipped the
  portfolio clause of `chats_read`); demo answers cited documents still awaiting review; "General BC sources"
  demo chats never found anything; the real firm review inbox listed a building's own pending reviews to its own
  staff; single-building accounts had no way to sign out; a shell with no buildings linked to routes that don't
  exist; upload/website forms hung on a non-JSON error; Copy on a grounded answer copied JSON (now text plus the
  disclaimer); the 404 page sent demo visitors out of the demo; the demo offered a password reset; an empty
  "Pending invitations" card; agents' Configure shown without `agent.manage`; plurals; missing `aria-pressed` on
  filters; all-caps literals (sentence case, per doc 06 §7); the kb ingest labelled the 27 Regulation forms as
  standard bylaws; the one ESLint warning.
- Tooling: dropped the root `packageManager: pnpm` field (the app uses npm and `package-lock.json`; Vercel's
  corepack would otherwise try pnpm); `engines` is Node ≥ 22.18 (runs `scripts/*.ts` directly); removed the
  stale `inngest/corpus-sync.ts` service-role exemption; removed the 14 September export artefacts
  (`SOURCE-MANIFEST.json`, `SNAPSHOT-STATUS.md`, `verification/`), now superseded by git history and this file.

## Known gaps, in rough priority order

1. **Nothing has run against a live Supabase project, model or Inngest.** First live milestone: sign up, create
   a building, upload a searchable PDF, confirm its structure, ask a question, get a cited answer.
2. **Uploads above ~4.5 MB will fail on Vercel** (function body limit), though the form allows 20 MB. Move to
   signed direct-to-Storage uploads. The real upload route also inserts the `documents` row before the storage
   upload, so a failed upload leaves a row that can only fail to index.
3. **OCR for scanned PDFs** is not implemented; scanned files fail with a clear message.
4. **Demo retrieval ignores** a chat's as-of date, source-type filter and an agent's knowledge base (the real
   `hybrid_search_building` applies them). It is a keyword match, not embeddings.
5. **Models:** `lib/ai/models.ts` uses Groq (`llama-3.1-8b-instant`, `gpt-oss-120b`) for fast/structure work;
   AGENTS.md §2 specifies `claude-haiku-4-5-20251001` for classification and routing. Decide and align.
6. **Account-linking actions** (`features/members/invite.ts`) rely on their RPCs for authorization rather than the
   `requirePermission` line AGENTS.md §3 asks every action to start with. Review when the DB is live.
7. Smaller: the demo firm-link "copy link" copies a path, not a full URL; member rows show a short user id
   instead of a name; `answer`/`stream` store message parts unvalidated (`as BylawMessage[]` in the adapters).
