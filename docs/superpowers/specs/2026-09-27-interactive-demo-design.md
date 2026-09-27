# BylawIQ — Interactive demo with mock data (design)

**Date:** 2026-09-27
**Status:** Approved in conversation
**Replaces:** the read-only `/preview` sample (`app/preview`, `lib/preview.ts`)

## 1. Goal

Anyone can open `/demo`, pick one of four sample people — admin, strata manager, building manager, resident — and use the real app screens as that person, fully interactively, with no Supabase, AI provider or storage configured. All mock code and data live in `mock/`, behind the same function names and return shapes as the real backend, so the demo never forks screen code and a real backend can replace the mock later by swapping one provider.

Success: each persona sees only what their role allows; every action on every screen works against the mock (create/edit/delete records, invite/remove members, invite/join/remove a strata firm, send for review, approve/request changes, comment, upload, add website, download, export, ask questions); changes persist for the browser session until "Reset demo".

## 2. Non-goals

- Real authentication, persistence across server restarts, real AI generation, real file storage or parsing.
- Resident AI and credits (Phase 4 of the roles spec). Residents in the demo are read-only, matching today's `owner_resident` permissions.

## 3. Architecture

### 3.1 Backend seam (`components/backend.tsx`)

A client context that every interactive component uses instead of importing server actions or hard-coding `/api` and `/b` paths:

```ts
export type Backend={
 base:''|'/demo';                 // prefix for app links: `${base}/b/${id}/${section}`, `${base}/workspace`
 api:'/api'|'/api/demo';          // prefix for upload, sources, download, export, chat
 mutate:typeof mutateAction;
 createFirmCode:typeof createFirmCodeAction; revokeFirmLink:typeof revokeFirmLinkAction; acceptFirmCode:typeof acceptFirmCodeAction;
 createChat:typeof createChatAction; branchChat:typeof branchChatAction;
 signOut:()=>Promise<void>;
};
export function BackendProvider({value,children}:{value:Backend;children:ReactNode}):JSX.Element;
export function useBackend():Backend;   // defaults to the real backend when no provider is present
```

The real app gets the real backend by default (no provider needed); `app/demo/layout.tsx` provides the mock backend. Mock action functions have identical signatures and return shapes to the real ones.

### 3.2 `mock/` folder

| File | Responsibility |
|---|---|
| `mock/personas.ts` | The four personas (id, name, email, account type, description, landing path) |
| `mock/data/*.ts` | Seed data: organizations, buildings, memberships, firm links, link codes, documents (with sample text chunks), knowledge bases, agents, bylaws + versions, notices + review comments, disputes + events, updates, invitations, audit, chats + messages |
| `mock/permissions.ts` | Copy of `role_permissions` from the migrations (role → permission list); `can(role,permission)` |
| `mock/store.ts` | Per-session in-memory store: `getStore(sessionId)` returns a deep clone of the seed on first use; `resetStore(sessionId)`; `nextId()` |
| `mock/session.ts` | Server-only cookie helpers: `demoSession()` → `{sessionId, persona}`; `startDemo(personaId)`; `endDemo()` |
| `mock/source.ts` | Read functions with the real shapes: `workspace()`, `buildingWorkspace(id)`, `listResource(resource,id)`, `conversation(chatId)`, `firmLinkStatus(id)`, `firmOrganizations()`, `firmReviewInbox()` |
| `mock/rules.ts` | Pure rule functions shared by actions and source (visibility: resident sees `owner_visible` docs only; firm staff see linked buildings; review state machine; code validation) |
| `mock/actions.ts` | `'use server'` mock actions: `mutateAction` (every operation in `features/workspace/schema.ts`), firm-link actions, `createChatAction`, `branchChatAction`, `signOutAction` |
| `mock/api.ts` | Handlers for `/api/demo/*`: upload, retry, sources, document download, artifact export, chat stream, chat stop |
| `mock/answers.ts` | Scripted, cited answers from the building's mock documents by keyword match; "no grounding found" when nothing matches |

Mock actions enforce the same permission and rule checks as the database (using `mock/permissions.ts` and `mock/rules.ts`) and return the same user-facing error messages as `lib/errors.ts`.

### 3.3 Routes

- `/demo` — persona picker (four cards) with a short explanation.
- `/demo/start/[persona]` — sets the demo cookies and redirects to the persona's landing page (used by the picker and by tests).
- `/demo/workspace`, `/demo/b/[buildingId]/[section]`, `/demo/b/[buildingId]/chat/[chatId]` — same components as the real pages, data from `mock/source.ts`.
- `app/api/demo/*` — thin route handlers calling `mock/api.ts`.
- `/preview/*` — redirects to `/demo`.
- Gate: every `/demo` and `/api/demo` route returns 404 unless `DEMO_MODE=on` (set in `.env.local` for dev and in CI for e2e; unset in production by default).

### 3.4 Personas

| Persona | Role | Scope | Landing |
|---|---|---|---|
| Dana Ruiz — Admin | `org_owner`, Coastline Strata (firm) | Harbour View, Marina Court, Seaside Towers (all linked to Coastline) | `/demo/workspace` |
| Sarah Chen — Strata manager | `portfolio_manager`, Coastline Strata | Same three buildings; Parkside has an unused firm code `PARK-7QK4`; 2 drafts waiting for review | `/demo/workspace` |
| James Park — Building manager | `building_manager`, Seaside Towers (own building org) | Seaside Towers only; firm link active to Coastline; one draft with changes requested | `/demo/b/<seaside>/ask` |
| Priya Nair — Resident | `owner_resident`, Seaside Towers, unit 1204 | Seaside Towers; owner-visible documents only (no bylaws — Bylaws needs `chat.use`, which residents lack) | `/demo/b/<seaside>/documents` |

Plus background people (council president, council member, a second building manager at Parkside, firm assistant) so member lists and reviews are realistic.

### 3.5 Navigation by permission

`components/shell.tsx` navigation items declare the permission they need (`ask`→`chat.use`, `bylaws`→`chat.use`, `documents`→`vault.read`, `notices`→`chat.use`, `disputes`→`dispute.read`, `updates`→`chat.use`, `agents`/`knowledge`→`agent.manage`, `members`→`member.read`, `settings`→`building.read`). Bylaws and Updates read `bylaw_nodes`/`bylaw_versions`/`notifications`, which the database gates behind `chat.use`, not `building.read`. Items the current user lacks are hidden. This applies to the real app as well.

### 3.6 Mock AI

`mock/answers.ts` tokenizes the question, scores the active building's mock document chunks (owner-visible only for residents — though residents have no `chat.use`), and returns up to three cited passages as a `data-answer` part with the same `AnswerData` shape as the real stream (`lib/chat-types.ts`). Every answer's text starts "Demo answer from sample documents." If nothing scores above zero, it returns the real "no grounding found" answer state. No model is called.

### 3.7 Safety

- A test fails if any file outside `mock/`, `app/demo/`, `app/api/demo/` or `components/backend.tsx`'s demo wiring imports `@/mock/...`.
- The demo shell shows a non-dismissible banner: "Demo — sample data. Changes reset when you choose Reset demo." with a Reset demo button and a "Switch person" link.
- The real app is unchanged in behaviour apart from permission-filtered navigation and the backend context.

## 4. Testing

- Vitest (`tests/mock/*.test.ts`): permissions per persona; resident isolation (no non-owner-visible documents, no notices, no disputes; every write forbidden); firm flow (building creates code → strata manager joins Parkside → sees it → building revokes → loses it); review flow (send → request changes needs comment → edit → resend → approve; building cannot approve firm review); CRUD for each resource; chat answer with and without matches; reset restores seed; import-boundary test.
- Playwright (`tests/e2e/demo.spec.ts` and the existing specs moved from `/preview` to `/demo`): each persona lands correctly and sees only its navigation; building manager invites firm and sends a draft for review; strata manager approves it; resident cannot see Notices. Accessibility checks carried over.
