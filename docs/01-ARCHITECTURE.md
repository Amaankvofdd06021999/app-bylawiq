# 01 — System Architecture

## 1. Shape of the system

```
┌─────────────────────────────────────────────────────────────────┐
│ BROWSER                                                          │
│  Next.js 16 App Router · React Server Components                 │
│  useChat (AI SDK 6) ── streams UIMessage parts ──┐               │
└──────────────────────────────────────────────────┼──────────────┘
                                                   │ HTTPS
┌──────────────────────────────────────────────────▼──────────────┐
│ VERCEL (Node runtime)                                            │
│                                                                  │
│  Middleware ── refresh session cookie, attach requestId          │
│      │                                                           │
│      ├─ Server Components ── read via DAL ── RLS-scoped client   │
│      ├─ Server Actions    ── CRUD, mutations                     │
│      └─ /api/chat         ── streamText + tools                  │
│                              │                                   │
│                              ├── retrieval tools (RLS-scoped)    │
│                              ├── drafting tools                  │
│                              └── action tools (approval-gated)   │
└──────────┬───────────────────────────────┬──────────────────────┘
           │                               │
┌──────────▼─────────────┐    ┌────────────▼──────────────────────┐
│ SUPABASE               │    │ ANTHROPIC API                      │
│  Postgres + pgvector   │    │  claude-sonnet-5   (generation)    │
│  RLS on every table    │    │  claude-haiku-4-5  (routing)       │
│  Auth + token hook     │    └────────────────────────────────────┘
│  Storage (private)     │
│  Realtime (presence)   │    ┌────────────────────────────────────┐
└──────────┬─────────────┘    │ INNGEST (background)               │
           │                  │  ingest · embed · corpus sync      │
           └──────────────────┤  digest · alerts                   │
                              └────────────────────────────────────┘
```

## 2. Why these boundaries

**Why not call the model from the browser?** The v1 prototype did. It leaked the API key, made rate limiting impossible, made auditing impossible, and made retrieval impossible — the browser can't hold a 50,000-chunk legal corpus. Everything AI-related is server-side. This is not negotiable.

**Why Node runtime, not Edge, for `/api/chat`?** The chat route calls Postgres with pgvector, runs multi-step tool loops, and can stream for 60+ seconds while drafting a long document. Edge has a constrained runtime and the Postgres driver story is worse. Use Node with `maxDuration = 300`. Static pages and middleware stay on Edge.

**Why Postgres for vectors instead of a dedicated vector DB?** The corpus is bounded — BC legislation, ~10k CRT decisions, plus per-building documents. Well under a million vectors for a long time. Keeping vectors in Postgres means retrieval is subject to the same RLS as everything else, which is the entire security model. A separate vector store would need its own tenant-isolation implementation, and that duplication is exactly where leaks come from.

**Why Inngest and not just cron?** Ingestion is a multi-step pipeline with retries (parse → chunk → embed → index), and a 200-page depreciation report exceeds any serverless request budget. Inngest gives durable steps, retries, and fan-out.

## 3. Request lifecycle: a chat message

```
1.  User types in composer, has attachments + scope chips set
2.  useChat.sendMessage({ text, files }) with body: { chatId, buildingId, scope }
3.  POST /api/chat
4.  requireUser()                    → verified claims from getClaims()
5.  requireMembership(user, buildingId) → 403 if the user has no active membership
6.  rateLimit(user.id)               → 429 if exceeded
7.  Load thread history from DB (not from client — client history is untrusted)
8.  Build system prompt: persona + mode + building metadata (NOT bylaw text)
9.  streamText({ model, tools, stopWhen: stepCountIs(8) })
10. Model calls search_building_documents({ query })
      → tool executes with the USER's RLS-scoped Supabase client
      → building_id is injected from the validated session, NOT from tool args
11. Hybrid retrieval runs (doc 04) → returns chunks with citation metadata
12. Model composes answer, emits citation parts
13. Stream persists on finish: onFinish → save assistant message + citations + usage
14. Client renders parts: text, citations, tool states, approval prompts
```

**Step 10 is the security keystone.** The tool signature accepts a query, never a `building_id`. The building comes from the server-side session context, closed over when the tool is constructed:

```ts
// features/chat/tools.ts
export function buildTools(ctx: { supabase: SupabaseClient; buildingId: string }) {
  return {
    search_building_documents: tool({
      description: 'Search this building\'s registered bylaws, rules, and minutes.',
      inputSchema: z.object({
        query: z.string().describe('Natural-language search over building documents'),
        docTypes: z.array(DocTypeSchema).optional(),
        asOfDate: z.string().date().optional(),
      }),
      // NOTE: no buildingId in the schema. The model cannot ask for another building.
      execute: async ({ query, docTypes, asOfDate }) =>
        hybridSearch(ctx.supabase, {
          buildingId: ctx.buildingId,   // from session, not from the model
          query, docTypes, asOfDate,
        }),
    }),
  };
}
```

Even if the model is prompt-injected into trying, there is no parameter to inject into. And `ctx.supabase` is the user's RLS-scoped client, so the query would return nothing anyway. Two independent layers.

## 4. Folder structure

```
.
├── AGENTS.md                    # symlinked to CLAUDE.md
├── docs/                        # this doc set
├── app/
│   ├── (marketing)/             # public, static, ISR
│   ├── (auth)/
│   │   ├── login/ signup/ invite/[token]/
│   ├── (app)/
│   │   ├── layout.tsx           # resolves shell: focused vs portfolio
│   │   ├── portfolio/           # multi-building only
│   │   ├── b/[buildingId]/
│   │   │   ├── layout.tsx       # building context provider + membership guard
│   │   │   ├── chat/[chatId]/
│   │   │   ├── vault/
│   │   │   ├── disputes/[disputeId]/
│   │   │   ├── documents/
│   │   │   └── settings/
│   │   └── admin/               # org-level: members, billing, audit
│   └── api/
│       ├── chat/route.ts
│       ├── upload/route.ts
│       └── inngest/route.ts
├── features/
│   ├── chat/                    # components/ actions.ts queries.ts tools.ts prompts.ts
│   ├── vault/
│   ├── disputes/
│   ├── documents/
│   ├── buildings/
│   ├── members/
│   └── retrieval/               # hybrid search, reranking, citation resolution
├── components/ui/               # shadcn primitives, no business logic
├── lib/
│   ├── supabase/                # server.ts client.ts admin.ts middleware.ts
│   ├── auth/                    # requireUser, requirePermission, claims
│   ├── errors.ts  logger.ts  env.ts  ratelimit.ts
├── supabase/
│   ├── migrations/
│   ├── functions/               # edge functions (custom access token hook)
│   ├── tests/                   # pgTAP RLS tests
│   └── seed.sql
├── inngest/                     # ingest.ts corpus-sync.ts digest.ts
└── e2e/                         # Playwright
```

## 5. The three Supabase clients

Getting this wrong is how leaks happen. There are exactly three, and they are not interchangeable.

| Client | File | Key | RLS | Use for |
|---|---|---|---|---|
| Browser | `lib/supabase/client.ts` | anon | Enforced | Realtime subscriptions, presence. Nothing else. |
| Server (user) | `lib/supabase/server.ts` | anon + user cookie | **Enforced** | **Default for everything.** All reads, all writes, all retrieval. |
| Admin | `lib/supabase/admin.ts` | service_role | **Bypassed** | Provisioning, background jobs on system corpora, webhooks. |

`lib/supabase/admin.ts` must start with:

```ts
import 'server-only';
// DANGER: bypasses RLS. Permitted callers are enumerated below.
// Adding a caller requires review from a second engineer.
//  - inngest/corpus-sync.ts     (system corpora, no building scope)
//  - inngest/ingest.ts          (writes chunks after explicit building auth upstream)
//  - features/members/invite.ts (creates auth users)
//  - app/api/webhooks/*         (no user session exists)
```

If a file imports `admin.ts` and is not on that list, the PR is rejected. Add a lint rule: `no-restricted-imports` scoped by path.

## 6. Runtime configuration

```ts
// app/api/chat/route.ts
export const runtime = 'nodejs';
export const maxDuration = 300;      // long document drafting
export const dynamic = 'force-dynamic';
```

```ts
// next.config.ts
experimental: { ppr: 'incremental' },   // shell static, chat dynamic
serverExternalPackages: ['@anthropic-ai/sdk'],
```

## 7. Caching rules

Legal answers age badly and are tenant-specific. The rules:

- **Never** cache assistant messages across users or buildings.
- **Do** cache embeddings of the *system* corpora (legislation, case law) — they are shared and immutable per version.
- **Do** cache query embeddings for 1 hour, keyed by hash of the normalised query text. Query text is not building-specific.
- **Do** cache the corpus version manifest for 5 minutes.
- Cache keys for anything retrieval-adjacent include `building_id` **and** `corpus_version`. When a building uploads a new bylaw version, `corpus_version` bumps and the old cache is unreachable.

```ts
const cacheKey = `retr:${buildingId}:${corpusVersion}:${sha256(normalizedQuery)}`;
```

## 8. Observability

| Signal | Tool | What we need it for |
|---|---|---|
| Traces | Vercel OTel + AI SDK telemetry | Which tool call was slow; how many steps the loop took |
| LLM spans | `experimental_telemetry: { isEnabled: true, functionId, metadata: { buildingId, chatId } }` | Cost per building, token attribution |
| Errors | Sentry, with PII scrubbing | Never log document content or resident names |
| Retrieval quality | Custom table `retrieval_traces` | Offline eval, and the Footprints UI (doc 10) |
| Audit | Append-only `audit_log` (doc 02) | Legal defensibility: who saw what, who sent what |

Every request carries a `requestId` set in middleware and propagated to logs, traces, and the `audit_log` row so a single incident can be reconstructed end to end.
