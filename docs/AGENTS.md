# AGENTS.md — Instructions for the AI Builder

> Drop this file at the repo root. Claude Code, Cursor, and Codex all read it automatically.
> Also symlink it: `ln -s AGENTS.md CLAUDE.md`

You are building **BylawIQ**, an AI assistant for British Columbia strata property law. Read this file completely before writing code. Then read the doc for the area you're working in (see index below).

---

## 0. The one rule that overrides everything

**A user must never see legal information derived from a building that is not the building they are currently scoped to.**

BylawIQ tells a strata manager what *their* building's bylaws say. If Building A's noise bylaw leaks into an answer about Building B, the manager sends a s.135 enforcement notice citing a bylaw that does not exist in that building. That notice gets overturned at the Civil Resolution Tribunal, the strata eats the costs, and the product is finished.

This is not a prompt-engineering problem. **Scope is enforced in Postgres, never in the system prompt.** Every retrieval query runs as the authenticated user through Row Level Security. If a prompt injection convinces the model to call `search_building_documents({ building_id: <other building> })`, the database returns zero rows. The model cannot cite what it cannot retrieve.

Any PR that adds a code path where building-scoped data is fetched with the `service_role` key in response to user input is rejected. No exceptions.

---

## 1. Document index — read in this order

| # | File | Read it when |
|---|---|---|
| 00 | `docs/00-PRODUCT-BRIEF.md` | Always first. Personas, jobs-to-be-done, the single vs multi-building split. |
| 01 | `docs/01-ARCHITECTURE.md` | Before touching structure. Stack, folder layout, request lifecycle. |
| 02 | `docs/02-DATA-MODEL.md` | Any schema, migration, or CRUD work. |
| 03 | `docs/03-RBAC-SECURITY.md` | Any auth, roles, RLS, or permissions work. |
| 04 | `docs/04-AI-RAG-PIPELINE.md` | Any retrieval, prompt, tool, or eval work. |
| 05 | `docs/05-UI-UX-SPEC.md` | Any screen, component, or interaction. |
| 06 | `docs/06-DESIGN-SYSTEM.md` | Any visual work. Tokens are non-negotiable. |
| 07 | `docs/07-API-CONTRACTS.md` | Any route handler or server action. |
| 08 | `docs/08-CICD-DEVOPS.md` | Any workflow, env var, or deploy config. |
| 09 | `docs/09-BUILD-ROADMAP.md` | Picking up work. Epics in dependency order. |
| 10 | `docs/10-AI-UX-PATTERNS.md` | Any AI-facing interaction. Pattern catalogue + which ones are mandatory. |
| 11 | `docs/11-LEGAL-SAFETY.md` | Prompts, disclaimers, output gating, audit. |

---

## 2. Stack — do not substitute

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server Components by default. `'use client'` only for interactivity. |
| Language | TypeScript, `strict: true` | No `any`. No `@ts-ignore` without a comment explaining why. |
| AI | Vercel AI SDK 6 (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`) | `streamText` server side, `useChat` client side. |
| Model (generation) | `claude-sonnet-5` | Legal reasoning + drafting. |
| Model (classification/routing) | `claude-haiku-4-5-20251001` | Intent routing, title generation, query expansion. |
| DB | Supabase Postgres + `pgvector` + `pg_trgm` | RLS on every table, no exceptions. |
| Auth | Supabase Auth + Custom Access Token Hook | See doc 03. |
| Storage | Supabase Storage, private buckets | Signed URLs only, 5 min TTL. |
| Styling | Tailwind CSS v4 + shadcn/ui | Tokens from doc 06. |
| Validation | Zod | Every boundary: route input, tool args, env, LLM structured output. |
| Testing | Vitest (unit), Playwright (e2e), pgTAP (RLS) | RLS tests are mandatory, see doc 08. |
| Hosting | Vercel | Node runtime for AI routes, not Edge (see doc 01 §6). |
| Queue | Inngest | Document ingestion, corpus sync, digest generation. |

If you believe a substitution is warranted, write the argument in the PR description and stop. Do not substitute unilaterally.

---

## 3. Conventions

### Files and folders
- Route groups: `app/(auth)`, `app/(app)`, `app/(marketing)`.
- Colocate: a feature owns `components/`, `actions.ts`, `queries.ts`, `schema.ts` under `features/<name>/`.
- Server-only modules import `'server-only'` at the top. Client-only modules import `'client-only'`.
- Never import from `features/a` into `features/b`. Shared code goes to `lib/` or `components/ui/`.

### Naming
- DB: `snake_case`, tables plural (`buildings`, `document_chunks`).
- TS: `camelCase` for values, `PascalCase` for types and components.
- Route handlers: `app/api/<resource>/route.ts`. Server actions: `features/<name>/actions.ts`, each exported fn suffixed `Action`.

### Data access
- **All reads and writes go through a Data Access Layer** in `features/<name>/queries.ts` / `actions.ts`. Components never construct a Supabase client.
- Every server action starts with three lines, in this order:
  ```ts
  const user = await requireUser();                    // 401 if absent
  const input = InputSchema.parse(raw);                // 400 if invalid
  await requirePermission(user, 'bylaw.draft', input.buildingId); // 403 if denied
  ```
  If any of the three is missing, the action is incomplete.
- Use `getClaims()` for verified JWT reads. Never trust `user_metadata` for authorization — it is user-writable. Authorization claims live in `app_metadata` only.

### Errors
- Throw typed errors from `lib/errors.ts` (`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `RateLimitError`).
- Never leak building names, user emails, or SQL in error messages returned to the client.
- Every caught error gets a `logger.error` with `{ userId, buildingId, requestId }` — never with document content.

---

## 4. Definition of done

A task is not done until all of these are true:

- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass.
- [ ] New tables have RLS enabled **and** a pgTAP test proving a user from Building A cannot read Building B's rows.
- [ ] New columns referenced in RLS policies have indexes.
- [ ] Every user-facing string is sentence case, active voice, and names things the user recognises (doc 06 §7).
- [ ] Loading, empty, and error states exist for every async surface. Not one of the three is optional.
- [ ] Keyboard reachable, visible focus ring, `prefers-reduced-motion` respected.
- [ ] Any AI output that could be sent to a resident passes through the verification gate (doc 11 §4).
- [ ] Migration is reversible or has a documented rollback.

---

## 5. Things that look helpful and are not

- **Do not** add a "search all my buildings" default. Cross-building search is opt-in, per query, and visually marked. Default scope is always the active building.
- **Do not** cache LLM responses across buildings, users, or orgs. Cache keys must include `building_id` and the corpus version. A cached answer served to the wrong building is the same failure as a retrieval leak.
- **Do not** let the model answer from parametric knowledge when retrieval returns nothing. Return the "no grounding found" state (doc 04 §8). An unsourced legal claim is worse than no answer.
- **Do not** make the legal disclaimer dismissible, collapsible, or conditional.
- **Do not** put the Anthropic API key anywhere the client can reach. There is one prototype in this repo's history that called `api.anthropic.com` from the browser. That pattern is dead; do not resurrect it.
- **Do not** write `SELECT *` in application queries. Column-level privileges are part of the security model (doc 03 §6).
- **Do not** generate a migration that drops or alters a column on `document_chunks` without a re-embedding plan. Re-embedding the corpus is a multi-hour job.

---

## 6. When you are unsure

Legal correctness beats shipping speed. If a spec is ambiguous about what the law requires, do not guess and do not have the model guess — leave a `// TODO(legal):` comment, implement the conservative path, and surface the question in the PR.

If a spec is ambiguous about UX, follow the pattern already used in the nearest comparable screen, and note the assumption.
