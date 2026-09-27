# Interactive demo with mock data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/demo` lets anyone act as an admin, strata manager, building manager or resident and use every real screen interactively against mock data kept entirely in `mock/`.

**Architecture:** A client `BackendProvider` context replaces direct imports of server actions and hard-coded `/api` and `/b` paths. The real app uses the real backend by default; `app/demo/layout.tsx` provides mock actions from `mock/actions.ts` and `/api/demo` handlers from `mock/api.ts`. Server pages under `app/demo` read from `mock/source.ts`, which returns the same shapes as `features/*/queries.ts`. State is an in-memory, per-session clone of seed data.

**Tech Stack:** Next.js 16 App Router (server components, server actions, route handlers), React 19 context, AI SDK 6 UI message streams (`createUIMessageStream`, `createUIMessageStreamResponse`), Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-interactive-demo-design.md`

## Global Constraints

- Every mock file lives under `mock/`; demo routes under `app/demo/` and `app/api/demo/`. Nothing else imports `@/mock/*` (enforced by a test in Task 6).
- Mock read functions return exactly the shapes the real ones return (`lib/schema.ts` types, `Row` rows with the same column names as `features/workspace/queries.ts` `resources`).
- Mock action functions have the same signatures and return shapes as the real ones (`{ok:true;id?:string;url?:string}|{ok:false;error:string}` for `mutateAction`, etc.) and return the same user-facing messages as `lib/errors.ts` (`checkDb` safe map, `ForbiddenError`, `NotFoundError`).
- Mock permissions are a copy of the `role_permissions` rows in `supabase/migrations/*.sql` (including `building.link_firm`, `review.act`); a user may act on a building only through their mock membership there.
- Demo routes and APIs return 404 unless `process.env.DEMO_MODE==='on'`.
- Demo answers never invent law: only passages from mock documents, prefixed "Demo answer from sample documents.", or the no-grounding state.
- UI strings sentence case; loading, empty and error states on every async surface; keyboard reachable.
- Match the surrounding compact code style. No `any`, no `@ts-ignore`.
- This Next.js version differs from training data: before using a Next API not already used in this repo, read the matching guide in `node_modules/next/dist/docs/`.

## Review Focus

1. A resident must never see a notice, dispute, audit row, member email, or non-owner-visible document, via any page or mock API (download included) → tests in Tasks 2 and 4.
2. A strata manager must lose a building immediately when the building removes the firm, including direct URL access (page redirects to `/demo/workspace?notice=access_removed`) → Task 3 test + Task 7 e2e.
3. Two browser sessions must not see each other's changes (store keyed by session cookie) → Task 1 test.
4. Visiting `/demo` routes with `DEMO_MODE` unset must 404 → Task 6 test.
5. Real app pages must behave exactly as before (backend context defaults to real) → Task 5 typecheck/build + existing tests.

---

### Task 1: Mock foundation — personas, permissions, seed data, store, session, rules

**Files:**
- Create: `mock/personas.ts`, `mock/permissions.ts`, `mock/data/index.ts` (+ split files under `mock/data/` as needed), `mock/store.ts`, `mock/session.ts`, `mock/rules.ts`
- Test: `tests/mock/store.test.ts`, `tests/mock/rules.test.ts`
- Move: content of `lib/preview.ts` (documents, bylaws, conversation etc.) into `mock/data/` as the Seaside/Harbour seed; do NOT delete `lib/preview.ts` yet (Task 5/6 remove its users).

**Interfaces (Produces):**
```ts
// mock/personas.ts
export type PersonaId='admin'|'strata'|'building'|'resident';
export type Persona={id:PersonaId;userId:string;name:string;email:string;title:string;description:string;accountType:'admin'|'multi_building'|'single_building'};
export const PERSONAS:Persona[];
export function persona(id:string):Persona|undefined;
export function landingPath(p:Persona,store:MockState):string; // '/demo/workspace' or '/demo/b/<id>/ask' | '/demo/b/<id>/documents'
// mock/permissions.ts
export const ROLE_PERMISSIONS:Record<AppRole,readonly string[]>;
export function permissionsFor(role:AppRole|null):string[];
// mock/store.ts
export type MockState={profiles:Profile[];organizations:Row[];orgMembers:Row[];buildings:Building[];members:Row[];firmLinks:Row[];linkCodes:Row[];documents:Row[];chunks:{documentId:string;buildingId:string;sectionRef:string|null;content:string}[];knowledge:Row[];agents:Row[];deployments:Row[];bylaws:Row[];versions:Row[];notices:Row[];comments:Row[];disputes:Row[];events:Row[];updates:Row[];invitations:Row[];audit:Row[];chats:Row[];messages:{id:string;chatId:string;role:'user'|'assistant';parts:unknown[]}[]};
export function seed():MockState;               // fresh deep clone
export function getStore(sessionId:string):MockState;
export function resetStore(sessionId:string):void;
export function newId():string;                 // crypto.randomUUID()
export function audit(s:MockState,actorId:string,buildingId:string|null,action:string,targetId:string|null):void;
// mock/session.ts  (import 'server-only')
export async function demoSession():Promise<{sessionId:string;persona:Persona}|null>; // reads cookies demo_session, demo_persona
export async function startDemo(id:PersonaId):Promise<void>;   // sets both cookies (httpOnly, sameSite lax, path '/'), new session id
export async function endDemo():Promise<void>;
// mock/rules.ts (pure)
export function membership(s:MockState,userId:string,buildingId:string):Row|undefined;  // active only
export function roleIn(s:MockState,userId:string,buildingId:string):AppRole|null;
export function can(s:MockState,userId:string,permission:string,buildingId:string):boolean;
export function accessibleBuildings(s:MockState,userId:string):Building[];
export function visibleDocuments(s:MockState,userId:string,buildingId:string):Row[]; // residents: owner_visible only
export function linkedFirmId(s:MockState,buildingId:string):string|null;
export function isLinkedMember(s:MockState,userId:string,buildingId:string):boolean;
```

Seed requirements (all ids are fixed UUIDs so tests and e2e can reference them; export them as `IDS`):
- Organizations: Coastline Strata (`kind:'firm'`, letterhead set); building orgs for Harbour View, Marina Court, Seaside Towers, Parkside.
- Org members: Dana (org_owner), Sarah (portfolio_manager), Lee Wong (portfolio_assistant) in Coastline; James (building_manager) in Seaside org; Omar Haddad (building_manager) in Parkside org.
- Buildings: Harbour View, Marina Court, Seaside Towers (linked to Coastline, active), Parkside (not linked; one unused firm code `PARK-7QK4`, stored as a sha256 hash, 7-day expiry).
- Memberships: firm staff via link on the three linked buildings (`via_link_id` set); James building_manager Seaside; Grace Liu council_president Seaside; Ben Ortiz council_member Seaside; Priya owner_resident Seaside (`unit:'1204'`); Omar building_manager Parkside.
- Documents per building (6–10, mixed types, some `owner_visible:true`), each with 2–4 chunks of plausible bylaw/rules text (noise, pets, parking, rentals, move-in fees) including `sectionRef`.
- Bylaws + versions for Seaside and Harbour (reuse `lib/preview.ts` content).
- Notices on Seaside: one draft, one `pending_review` with `review_by:'firm'`, one `changes_requested` with a firm comment, one approved; on Harbour: one `pending_review` firm review. Review comments accordingly.
- Disputes + events, updates (some `state:'new'`), invitations (one pending), audit rows, one chat with the conversation from `lib/preview.ts` owned by James.

- [ ] **Step 1: Write failing tests** — `tests/mock/store.test.ts`: `getStore('a')` and `getStore('b')` are independent (mutating one leaves the other); `resetStore` restores seed; `seed()` returns a fresh clone each call. `tests/mock/rules.test.ts`: Priya's `accessibleBuildings` is `[Seaside]`; `visibleDocuments` for Priya only has `owner_visible` docs; Sarah accesses Harbour, Marina, Seaside, not Parkside; `can(s,priya,'chat.use',seaside)` is false; `can(s,james,'building.link_firm',seaside)` true; `can(s,sarah,'review.act',seaside)` true; `isLinkedMember(s,sarah,seaside)` true, `(s,james,seaside)` false.
- [ ] **Step 2: Run** `pnpm vitest run tests/mock` — expect FAIL (modules missing).
- [ ] **Step 3: Implement** the files above. `ROLE_PERMISSIONS` must be derived by reading the `insert into public.role_permissions` statements in `supabase/migrations/` (identity migration plus `20260927090000_firm_links_schema.sql`) — copy them as literal arrays with a comment naming the source migrations.
- [ ] **Step 4: Run** `pnpm vitest run tests/mock && pnpm typecheck` — PASS.
- [ ] **Step 5: Commit** `Add mock personas, seed data and session store`.

---

### Task 2: Mock read source

**Files:** Create `mock/source.ts`; Test `tests/mock/source.test.ts`.

**Interfaces:**
- Consumes: Task 1.
- Produces (same return types as the real functions — read `features/workspace/queries.ts` and `features/firm-links/queries.ts`):
```ts
export function workspace(s:MockState,userId:string):{profile:Profile;buildings:Building[];organizations:Row[];memberships:Row[];email:string};
export function buildingWorkspace(s:MockState,userId:string,buildingId:string):ReturnType<typeof workspace>&{building:Building;unreadUpdates:number;permissions:string[];linkedMember:boolean}; // throws NotFoundError if not accessible
export function listResource(s:MockState,userId:string,resource:Resource,buildingId:string):Row[]; // same columns as real `resources` map; applies visibility (resident docs, own chats only, comments only if chat.use, notices/disputes/audit/invitations only with the permission the real RLS requires)
export function conversation(s:MockState,userId:string,chatId:string):{chat:Chat;messages:{id:string;role:'user'|'assistant';parts:unknown[]}[]};
export function firmLinkStatus(s:MockState,userId:string,buildingId:string):FirmLinkStatus|null;
export function firmOrganizations(s:MockState,userId:string):{id:string;name:string}[];
export function firmReviewInbox(s:MockState,userId:string):{id:string;building_id:string;title:string;kind:string;created_at:string}[];
```
Functions take `(state,userId,…)` so they are pure and testable; `app/demo` pages call them with `getStore(session.sessionId)` and `session.persona.userId`.

RLS parity (mirror the policies in the migrations): documents need `vault.read` (+ `owner_visible` for residents); notices/`generated_documents` need `chat.use`; disputes need `dispute.read`; members need `member.read` (or own row); invitations need `member.invite`; audit needs `audit.read`; chats: own only; comments: `chat.use`; updates: `building.read`… check each policy in the migrations and mirror it.

- [ ] **Step 1: Failing tests** — for each persona, `workspace()` buildings list; `buildingWorkspace` throws `NotFoundError` for Sarah on Parkside and for Priya on Harbour; Priya's `listResource('notices'|'disputes'|'audit'|'invitations', seaside)` all `[]`; Priya's documents are only owner-visible; `firmReviewInbox` for Sarah has 2 items, for James `[]`; `firmLinkStatus(james,seaside).status==='active'`, `(omar,parkside).status==='invited'`, `(priya,seaside)===null`; `buildingWorkspace(sarah,seaside).linkedMember===true`.
- [ ] **Step 2: Run** `pnpm vitest run tests/mock/source.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit** `Add mock read source with role-based visibility`.

---

### Task 3: Mock actions (every mutation)

**Files:** Create `mock/actions.ts` (`'use server'`), `mock/mutations.ts` (pure `(state,userId,input)` functions the actions call — testable without cookies); Test `tests/mock/mutations.test.ts`.

**Interfaces:**
- Consumes: Tasks 1–2; `mutationSchema`, `values` from `features/workspace/schema.ts`; message strings from `lib/errors.ts`.
- Produces:
```ts
// mock/mutations.ts (pure)
export function mutate(s:MockState,userId:string,raw:unknown):{ok:true;id?:string;url?:string}|{ok:false;error:string};
export function createFirmCode(s,userId,raw):{ok:true;code:string;url:string}|{ok:false;error:string};
export function revokeFirmLink(s,userId,raw):{ok:true}|{ok:false;error:string};
export function acceptFirmCode(s,userId,raw):{ok:true;buildingId:string}|{ok:false;error:string};
export function createChat(s,userId,raw):{ok:true;id:string}|{ok:false;error:string};
export function branchChat(s,userId,raw):/* same shape as real branchChatAction */;
// mock/actions.ts ('use server') — same names & signatures as the real actions:
export async function mutateAction(raw:unknown); export async function createFirmCodeAction(raw:unknown); export async function revokeFirmLinkAction(raw:unknown); export async function acceptFirmCodeAction(raw:unknown); export async function createChatAction(raw:unknown); export async function branchChatAction(raw:unknown); export async function signOutAction():Promise<void>; export async function resetDemoAction():Promise<void>; export async function switchPersonaAction(id:string):Promise<void>;
```
Each action: `const session=await demoSession(); if(!session) return {ok:false,error:'Please sign in to continue.'};` then call the pure function with `getStore(session.sessionId)` and `session.persona.userId`, then `revalidatePath('/demo','layout')`.

Implement every operation in `mutationSchema` (read `features/workspace/actions.ts` for each case and mirror its permission via the same `permissions` map and the DB function's rules):
`building.create` (firm org only → new building org + active link + link members), `building.update`, `building.archive` (not for linked members), `knowledge.save/delete`, `agent.save/deploy/pause/delete` (deploy requires a ready document in the KB → `knowledge_not_ready`), `document.update/delete/confirm`, `bylaw.save/transition/register` (mirror `transition_bylaw` and `record_registered_bylaw` states incl. `legal_review_required` for fines/rentals words, `invalid_transition`), `notice.save` (create/edit; editing a firm-pending draft withdraws it with the comment "This draft was edited, which withdrew it from strata management review."), `notice.transition` (mirror `transition_artifact` incl. `firm_review_pending`, `self_approval_not_permitted`), `notice.firm_review`, `notice.firm_decision` (`comment_required`), `notice.comment`, `dispute.save/event`, `update.state` (council members can only mark viewed), `member.change` (`linked_member`, rank rules from `can_assign`), `member.invite` (returns `url:'/demo/invite/<token>'` — the page just explains invitations are simulated), `invite.revoke`, `org.update`, `chat.rename/archive`.
Firm links: mirror `create_firm_code`, `accept_firm_code` (normalize with `lib/link-codes.ts` `normalizeCode` + `hashCode`; errors `invalid_code|revoked_code|expired_code|wrong_code_kind|firm_already_linked|forbidden`), `revoke_firm_link` (suspend link members, revoke codes, cancel invitations by linked staff, return firm reviews to draft with the system comment). Every successful write appends an audit row.

- [ ] **Step 1: Failing tests** covering: building manager creates code → Sarah accepts (lowercase, no dash) → Sarah can access Seaside… use Parkside: Omar creates a new code (old one replaced → `revoked_code`), Sarah accepts, Sarah’s `accessibleBuildings` includes Parkside, Omar revokes, Sarah loses it; review flow on Seaside (James sends draft → Grace cannot approve → `firm_review_pending`; Sarah requests changes without comment → `comment_required`; with comment → `changes_requested`; James edits → draft; resend; Sarah approves); Priya: every operation returns the forbidden message; CRUD happy path for documents, bylaws, disputes, agents, members; resident cannot `chat.create`.
- [ ] **Step 2: Run** `pnpm vitest run tests/mock/mutations.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS; `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** `Add mock actions for every workspace operation`.

---

### Task 4: Mock API — upload, sources, download, export, chat

**Files:** Create `mock/answers.ts`, `mock/api.ts`; create route handlers `app/api/demo/upload/route.ts`, `app/api/demo/upload/retry/route.ts`, `app/api/demo/sources/route.ts`, `app/api/demo/documents/[id]/download/route.ts`, `app/api/demo/artifacts/[id]/export/route.ts`, `app/api/demo/chat/route.ts`, `app/api/demo/chat/[id]/stop/route.ts`, `app/api/demo/chat/[id]/stream/route.ts` (mirror the real `app/api/*` request/response contracts — read each real route first). Test `tests/mock/api.test.ts`, `tests/mock/answers.test.ts`.

**Interfaces:**
```ts
// mock/answers.ts (pure)
export function answer(s:MockState,userId:string,buildingId:string,question:string):AnswerData; // lib/chat-types.ts shape; sources use lib/ai/citations sourceSchema; no-grounding when no match
// mock/api.ts — one handler per route, each `(req:Request, params?) => Promise<Response>`; every handler first checks DEMO_MODE and demoSession() (404 / 401)
```
- Upload: accept the same form fields as `/api/upload`, create a `documents` row (`status:'ready'`, `structure_confirmed:true` except bylaws → `status:'review'` with a small `parsed_sections`), create one chunk from the file name/title, respond like the real route.
- Sources: create a `documents` row with `source_url`.
- Download: permission + visibility check (resident owner-visible only), return a generated `.txt` with the document's chunks (`Content-Disposition: attachment`).
- Export: use `lib/export.ts` `exportPdf`/`exportDocx` with the linked firm's letterhead.
- Chat POST: body `{id,message}` like the real route; permission `chat.use`; append user message; stream an assistant message via `createUIMessageStream` writing a transient `data-progress` ("Searching sample documents"), then a `data-answer` part with `answer(...)`; persist the assistant message; `createUIMessageStreamResponse`. Stop/stream routes: return 204 / empty replay.

- [ ] **Step 1: Failing tests** — `answer()` for "Can I have a dog?" on Seaside cites the pets section; nonsense question returns no-grounding; download as Priya of a non-owner-visible doc → 404; as James → 200 with text; upload as Priya → 403; chat POST as Priya → 403; chat POST as James returns a stream whose text contains `data-answer`.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS), `pnpm typecheck`.
- [ ] **Step 5: Commit** `Add mock upload, download, export and cited demo answers`.

---

### Task 5: Backend context, base paths and permission-filtered navigation

**Files:** Create `components/backend.tsx`. Modify `components/shell.tsx`, `features/workspace/components/{resources,resource-form,review-thread,portfolio}.tsx`, `features/chat/components/chat-ui.tsx`, `features/firm-links/components/{strata-management-card,join-building-form,review-inbox}.tsx`, `features/members/linked-accounts.tsx`, and `app/preview/[[...path]]/page.tsx` (becomes `redirect('/demo')`).

**Interfaces:** `Backend`, `BackendProvider`, `useBackend` exactly as spec §3.1; the default value is built from the real actions (`mutateAction`, `createFirmCodeAction`, `revokeFirmLinkAction`, `acceptFirmCodeAction`, `createChatAction`, `branchChatAction`, `signOutAction`) with `base:''`, `api:'/api'`. `components/backend.tsx` must be `'use client'` and must not import `@/mock`.

Steps:
- [ ] Replace every direct action import and call in the files above with `const backend=useBackend()` and `backend.mutate(...)` etc.
- [ ] Replace every hard-coded `'/api/...'` with `backend.api+'/...'` and every `'/b/'`, `'/workspace'` link with `backend.base+'/b/'…` / `backend.base+'/workspace'`. Remove the `preview` props and read-only branches (`if(preview){setError(...)}`, `preview?'/preview':...`) — the demo is interactive now. Server components that render links (e.g. `review-inbox.tsx`, `portfolio.tsx`) receive `base` as a prop from their page instead of the hook if they are not client components.
- [ ] Shell navigation: give each item its permission (spec §3.5); Shell receives `permissions?:string[]` (all real pages already have them from `buildingWorkspace`; `/workspace` has none → show only items that don't need a building). Hide items the user lacks.
- [ ] `app/preview/[[...path]]/page.tsx` → `redirect('/demo')`. Delete `lib/preview.ts` if nothing imports it any more (its content moved to `mock/data` in Task 1).
- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — PASS.
- [ ] Commit `Route screens through a backend context and filter navigation by permission`.

---

### Task 6: Demo routes, gate, banner and import boundary

**Files:** Create `app/demo/layout.tsx`, `app/demo/page.tsx` (persona picker), `app/demo/start/[persona]/route.ts` (GET: `startDemo`, redirect to landing), `app/demo/workspace/page.tsx`, `app/demo/b/[buildingId]/[section]/page.tsx`, `app/demo/b/[buildingId]/chat/[chatId]/page.tsx`, `app/demo/invite/[token]/page.tsx`, `mock/backend.ts` (client-safe object assembling the mock actions for the provider), `components/demo-banner.tsx` is NOT allowed outside mock — put the banner in `mock/components/demo-banner.tsx`. Modify `.env.example` (add `DEMO_MODE=on` with comment), `lib/env.ts` (`demoEnabled()`). Test `tests/mock/boundary.test.ts`, `tests/mock/gate.test.ts`.

Requirements:
- Layout: if `!demoEnabled()` → `notFound()`. Wraps children in `BackendProvider` with `{base:'/demo',api:'/api/demo',...mock actions}` and renders the banner ("Demo — sample data. Changes reset when you choose Reset demo." + Reset demo button calling `resetDemoAction` + "Switch person" link to `/demo`).
- Picker: four cards (name, title, what they can do), each a link to `/demo/start/<id>`. Sentence case, keyboard reachable.
- Pages mirror the real `app/(app)` pages line by line but read from `mock/source.ts` with the session's store and user; no session → redirect `/demo`; inaccessible building → redirect `/demo/workspace?notice=access_removed`; single-building personas redirect from workspace to their landing page (unless the notice is present).
- Boundary test: scan all `.ts/.tsx` files outside `mock/`, `app/demo/`, `app/api/demo/`, `tests/` for `@/mock` or `/mock/` imports → none.
- Gate test: call the demo API handler with `DEMO_MODE` unset → 404.

- [ ] Steps: failing tests → implement → `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → commit `Add the interactive demo with four sample people`.

---

### Task 7: End-to-end tests

**Files:** Modify `playwright.config.ts` (base URL and webServer URL from `process.env.E2E_PORT ?? '3000'`; webServer env `DEMO_MODE=on`; health URL `/demo`), `tests/e2e/workspace.spec.ts`, `tests/e2e/responsive.spec.ts` (move from `/preview/...` to `/demo/start/building` then the same sections), `.github/workflows/ci.yml` (set `DEMO_MODE: on` for the e2e job). Create `tests/e2e/demo.spec.ts`.

`demo.spec.ts` scenarios: each persona lands on its page and sees only its nav items (resident: no Notices/Disputes/Ask); building manager creates a firm code on Parkside? (use Omar? not a persona) → instead: building manager sends the draft notice to strata management; switch to strata manager → inbox shows it → approve; resident opens Documents and sees only owner-visible titles; a direct URL to a building the persona can't access redirects with the access-removed notice. Keep the existing axe checks.

- [ ] Run locally with `E2E_PORT=3100 pnpm test:e2e` (port 3000 is used by another project on this machine). PASS.
- [ ] Commit `Cover the demo personas end to end`.

---

### Task 8: Verification

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` and `E2E_PORT=3100 pnpm test:e2e` — all pass.
- [ ] `git status --short` clean apart from `next-env.d.ts`.
