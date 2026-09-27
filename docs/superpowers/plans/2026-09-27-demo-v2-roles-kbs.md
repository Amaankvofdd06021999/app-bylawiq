# Demo v2 — role dashboards, layered knowledge, paid residents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** In `/demo`, five people (platform admin, firm owner, strata manager, building manager, paid resident) each get their own home screen; knowledge is split into Building / Firm / Law layers; the AI answers by layer and only from layers the person may see; the resident gets paid features (credits, cited Q&A, explainers and alerts, draft notice to council, reply to a strata letter).

**Architecture:** Demo-first and backend-ready. New data lives in `mock/`. New UI components live in `features/*` and receive data as props or call `useBackend()`; they never import `@/mock`. New backend operations are added to the `Backend` type in `components/backend.tsx`; the real default for not-yet-built operations returns `{ok:false,error:'This feature isn’t available yet.'}`. Citations gain a `firm` kind in `lib/ai/citations.ts` (backwards compatible).

**Tech Stack:** Next.js 16, React 19, AI SDK 6 UI streams, Zod, Vitest, Playwright.

**Spec (agreed in conversation, 2026-09-27):** the design message approved by the user ("just build it"); summarised below — this section is binding.

## Binding design

1. **Knowledge layers.**
   - `building`: that building's documents (residents: `owner_visible` only). Visible to members of that building.
   - `firm`: Coastline Strata's firm knowledge — four collections: *Templates & precedents*, *Policies & procedures*, *Guidance notes*, *CRT & legislation tracker*. Visible to firm staff only (`org_members` of the firm with roles `org_owner|org_admin|portfolio_manager|portfolio_assistant`). Never visible to building managers, council or residents. Precedents are stored anonymised (no names, units, or other buildings' facts).
   - `legal`: Strata Property Act sections, Strata Property Regulation, CRT decisions (mock corpus). Visible to everyone with Ask access.
2. **Layered answers.** Retrieval searches only the layers the person may see (and only the active building's building layer). Every citation has `kind:'building'|'firm'|'legal'`. The answer UI groups claims by the layer of their cited sources, in this order and with these headings: "What Seaside Towers’ bylaws say" (building — the only binding layer), "What the law says" (legal), "How Coastline handles this (internal practice — not law or bylaw)" (firm, firm staff only). Filter chips under the question box — Building · Firm · Law — narrow the search (Firm chip shown only to firm staff). If a firm or legal passage conflicts with the building's bylaw on an amount (e.g. fine $200 vs bylaw cap $100), the answer's `limitations` names the conflict and says the building's bylaw governs within the Act's limits. No match in any allowed layer → the existing "no grounding found" state. Answers start "Demo answer from sample documents."
3. **People (demo personas).**
   | id | Name | Role | Home |
   |---|---|---|---|
   | `platform` | Alex Kim | BylawIQ platform admin (`platform_admin`, no building memberships) | `/demo/admin` |
   | `owner` | Dana Ruiz | Firm owner (`org_owner`, Coastline) | `/demo/workspace` (firm owner dashboard) |
   | `strata` | Sarah Chen | Strata manager (`portfolio_manager`) | `/demo/workspace` (strata manager dashboard) |
   | `building` | James Park | Building manager, Seaside Towers | `/demo/b/<seaside>/home` |
   | `resident` | Priya Nair | Resident, unit 1204, **paid** (credits) | `/demo/b/<seaside>/home` |
   The old persona id `admin` is renamed `owner`; `/demo/start/admin` redirects to `/demo/start/owner` for old links.
4. **Dashboards.**
   - *Platform admin*: customers table (firms and independent buildings: plan, seats used/included, MRR, status), revenue cards (MRR, launch-discount MRR, resident credit sales this month), AI usage (questions this month, estimated cost, no-grounding rate, top buildings by questions), knowledge health (documents failed/scanning, bylaws not structure-confirmed, legal corpus last updated), feature flags (resident AI on/off — toggle works in the store, shows "needs legal sign-off before production"), recent platform audit. No building document content anywhere on this screen.
   - *Firm owner*: staff table (name, role, buildings, open reviews, last active), building roster (link status, since, health, open disputes), review turnaround (median hours, oldest waiting), firm knowledge base summary with link to manage it, plan & billing card (Strata Manager, ~~$199~~ $99.50/mo launch price), pending invitations and join codes.
   - *Strata manager*: "Needs attention today" list across her buildings (reviews waiting on her, dispute deadlines within 14 days, approved notices not yet sent, law changes affecting her buildings), building cards (health, open items), firm knowledge shortcuts, "Ask across buildings" entry, join a building, review inbox.
   - *Building manager*: one building — health card, drafts and their review status with the firm, council tasks (unread updates, disputes stages), residents count + join code (mock), firm connection card (reuse `StrataManagementCard`), plan & seats (Building plan $99/mo, 3 seats included, used N), quick actions (draft a notice, ask, upload).
   - *Resident*: credits card (balance, free questions left, "Buy 100 credits · $20" → mock checkout dialog labelled "Demo — no real charge"), tools grid with credit costs (Ask — 1 credit; Bylaw explainers — included; Draft a notice to council — 5 credits; Reply to a strata letter — 3 credits), alerts (bylaw changes at her building), recent owner-visible documents, credit history.
5. **Resident paid features** (demo; drafting tools show a non-dismissible banner "Drafting help for owners needs legal sign-off before launch — demo only"):
   - Ask: allowed for residents in the demo via a mock-only permission `chat.resident` (building layer limited to owner-visible docs + legal layer; never firm). Spending: first 2 questions free, then 1 credit; drafting never uses free questions. Insufficient credits → paywall dialog with buy option; after buying, the action proceeds.
   - Explainers: plain-language summaries of each owner-visible bylaw section, each citing its source passage.
   - Alerts: bylaw-change alerts for her building (seeded; new ones appear when a building manager marks a bylaw in force in the demo).
   - Draft a notice to council (5 credits): form (topic, what happened, what you want) → draft letter citing relevant owner-visible bylaws; saved privately to her "My drafts"; copy/download.
   - Reply to a strata letter (3 credits): paste letter text → plain-language explanation + draft reply citing bylaws; saved to "My drafts".
   - Credits: seeded Priya with 87 credits, 2 free questions used, a purchase and some spends in her ledger.
6. **Firm knowledge management** (Knowledge section): tabs *Building* (existing) and *Firm* (firm staff only). Firm tab lists the four collections with documents; firm owner and portfolio managers can add/edit/delete firm documents (title, collection, body text → chunks); assistants read-only.
7. **Safety.** Residents and building managers never receive firm-layer content from any page, API or answer. Platform admin sees aggregates only. Everything demo-only stays behind `DEMO_MODE`. No `@/mock` imports outside `mock/`, `app/demo`, `app/api/demo`, `tests`.

## Global constraints

- Mirror existing patterns: pure functions `(state,userId,…)` in `mock/`, thin `'use server'` wrappers in `mock/actions.ts`, route handlers in `app/api/demo/*` calling `mock/api.ts`.
- New UI components under `features/dashboards/components/`, `features/residents/components/`, `features/knowledge/components/` with prop types in a sibling `types.ts`; they import only `components/*`, `lib/*` and their own feature.
- Sentence case, active voice, loading/empty/error states, keyboard reachable, visible focus, design tokens from `app/globals.css` (no hard-coded colours).
- No `any`, no ts-ignore. `pnpm typecheck && pnpm lint && pnpm test` before each commit; `pnpm build` and e2e in the tasks that say so.
- Ports 3000/3001 are busy; e2e via `pnpm build && E2E_START=1 E2E_PORT=3100 pnpm test:e2e`.

---

### Task 1: Data, personas, layers and rules

**Files:** `mock/personas.ts`, `mock/permissions.ts`, `mock/rules.ts`, `mock/store.ts` (`MockState` additions), `mock/data/*` (new: `firm-knowledge.ts`, `legal.ts`, `residents.ts`, `platform.ts`), `app/demo/start/[persona]/route.ts` (admin→owner alias), `app/demo/page.tsx` (five cards), `lib/ai/citations.ts` (`kind` adds `'firm'`), tests under `tests/mock/`.

- `MockState` adds: `firmDocs:{id,orgId,collection:'templates'|'policies'|'guidance'|'legal_tracker',title,body,updated_at,created_by}[]`, `firmChunks:{docId,orgId,sectionRef,content}[]`, `legalChunks:{id,source:'act'|'regulation'|'crt',title,citation,sectionRef,content}[]`, `wallets:{userId,buildingId,credits,freeQuestionsUsed}[]`, `ledger:{id,userId,buildingId,delta,reason:'purchase'|'question'|'draft_notice'|'letter_reply'|'free_question',at}[]`, `residentDrafts:{id,userId,buildingId,kind:'notice_to_council'|'letter_reply',title,body,sources:unknown[],created_at}[]`, `alerts:{id,buildingId,title,body,created_at}[]`, `platform:{plans:Row[];usage:Row[];flags:{residentAi:boolean};audit:Row[]}` plus `profiles` entry for Alex (`account_type:'admin'`).
- Rules (pure, exported, tested): `layersFor(s,userId,buildingId):('building'|'firm'|'legal')[]`; `isFirmStaff(s,userId,orgId)`; `firmOf(s,userId):string|null`; `canResidentAsk(s,userId,buildingId)`; `isPlatformAdmin(s,userId)`.
- Seed: firm docs with realistic, anonymised content across the four collections (e.g. "Noise complaint procedure", "s.135 notice template", "Fine schedule guidance — assumes $200 max" (to trigger the Seaside conflict: Seaside bylaw caps noise fines at $100), "CRT tracker: pets and emotional support animals"); legal chunks for SPA ss. 26, 31, 130, 135, 141, 165 and 2–3 CRT decisions (fictional names, clearly marked sample); Priya's wallet/ledger/drafts/alerts; platform plans/usage for all firms and buildings.
- Tests: `layersFor` for each persona (Sarah on Seaside → all three; James → building+legal; Priya → building+legal; Alex → none), firm staff check, persona list/landing paths, admin→owner alias.
- Commit: `Add firm knowledge, legal corpus, resident credits and platform data to the demo`.

### Task 2: Layered AI answers and resident credits in Ask

**Files:** `mock/answers.ts`, `mock/api.ts` (chat), `mock/mutations/chat.ts` (resident chat + spending), `features/chat/components/chat-ui.tsx` (layer chips, grouped rendering, source badges per layer, paywall hook), `components/backend.tsx` (no new members needed if chips travel in the chat request body as `layers`), real `app/api/chat/route.ts` must ignore unknown `layers` (verify its zod schema doesn't reject it; if it does, allow and ignore an optional `layers` field). Tests: `tests/mock/answers.test.ts`, `tests/mock/api.test.ts`.

- `answer(s,userId,buildingId,question,layers?)` searches `layersFor(...)` ∩ requested layers; groups; conflict detection on dollar amounts between building and firm/legal passages on the same topic; resident answers never include firm.
- Chat POST as resident: requires `canResidentAsk` and the platform flag `residentAi`; spends a free question or 1 credit; on insufficient credits returns HTTP 402 JSON `{error:'You’re out of credits.',code:'paywall'}`; the chat UI shows the paywall dialog (buy via `backend.buyCredits`, added in Task 4 — until then the dialog links to the Credits page).
- UI: grouping by `source.kind` with the headings from Binding design §2; badge per source: building name / "Coastline internal" / "Legal source"; chips toggle `layers` sent in the request body; Firm chip hidden unless any firm source is possible (pass `layers` available from the page: add `availableLayers` prop to `AskHome`/`Conversation`, default `['building','legal']` for the real app).
- Tests: Sarah asking about noise fines on Seaside gets building + legal + firm groups and a conflict note; James gets no firm; Priya gets no firm and spends credits; with 0 credits → 402; chips restrict layers.
- Commit: `Answer by knowledge layer with firm, building and law kept apart`.

### Task 3: Role dashboards

**Files:** `features/dashboards/types.ts`, `features/dashboards/components/{platform-admin,firm-owner,strata-manager,building-manager}.tsx`, `mock/dashboards.ts` (pure builders returning those prop types), `app/demo/admin/page.tsx` (platform admin; outside building shell — use `Shell` with no buildings or a simple admin layout consistent with the app's styles), `app/demo/workspace/page.tsx` (render firm owner or strata manager dashboard by role, keep join form + inbox inside the strata dashboard), `app/demo/b/[buildingId]/[section]/page.tsx` (new `home` section: building manager dashboard; resident home comes in Task 4 — until then resident `home` falls back to documents), platform flag toggle action (`mock/actions.ts` `setResidentAiAction`, Backend member `setFlag` with real default not-available). Tests: `tests/mock/dashboards.test.ts` (builders' numbers from seed: MRR sums, needs-attention items for Sarah, staff table for Dana, seats for James; platform admin cannot load building pages → redirected to /demo/admin).
- Every dashboard: page heading, cards grid, tables with empty states, links into the relevant sections using `backend.base`.
- Commit: `Give each demo role its own home screen`.

### Task 4: Resident paid tools and firm knowledge management

**Files:** `features/residents/components/{resident-home,credits-card,paywall-dialog,explainers,draft-notice,reply-letter,my-drafts,legal-banner}.tsx`, `features/residents/types.ts`, `features/knowledge/components/firm-knowledge.tsx`, `features/knowledge/types.ts`, `mock/residents.ts` (pure: explainers, draft generation from bylaw passages, spend, buy), `mock/mutations/firm-knowledge.ts`, `mock/actions.ts` (+ `buyCreditsAction`, `residentDraftAction`, `saveFirmDocAction`, `deleteFirmDocAction`), `components/backend.tsx` (+ `buyCredits`, `residentDraft`, `saveFirmDoc`, `deleteFirmDoc` with not-available real defaults), `app/demo/b/[buildingId]/[section]/page.tsx` (resident sections `home`, `explainers`, `draft`, `reply`, `credits`, `my-drafts`; `knowledge` section shows Building/Firm tabs), `components/shell.tsx` (nav items for resident sections only when the page passes a `residentNav` flag / permission `chat.resident`; firm KB appears inside Knowledge). Tests: `tests/mock/residents.test.ts`, `tests/mock/firm-knowledge.test.ts`.
- Draft generation is deterministic templating from cited owner-visible passages (no model): greeting, facts from the form, cited bylaw sections, request, sign-off with unit number. Reply: "What this letter means" bullets (keyword-matched against bylaws) + draft reply.
- Firm knowledge: James/Priya requesting firm docs → forbidden; Lee (assistant) read-only; Dana/Sarah CRUD; new firm docs become answerable in Ask for firm staff.
- Commit: `Add paid resident tools and firm knowledge management to the demo`.

### Task 5: End-to-end and polish

**Files:** `tests/e2e/demo.spec.ts` (update for five personas: each lands on its home and sees the right heading; Sarah's answer shows the internal-practice section and James's does not; Priya buys credits, asks, drafts a notice; Alex sees revenue and toggles resident AI), `app/demo/page.tsx` copy, any fixes found. Run full `pnpm typecheck && pnpm lint && pnpm test && pnpm build && E2E_START=1 E2E_PORT=3100 pnpm test:e2e`.
- Commit: `Cover the five demo roles end to end`.
