# 08 — CI/CD, Environments and Testing

## 1. Environments

| Env | Git branch | Vercel | Supabase | Data |
|---|---|---|---|---|
| Local | any | `pnpm dev` | `supabase start` (Docker) | Seeded fixtures |
| Preview | any PR | Preview deployment | Supabase preview branch | Seeded fixtures |
| Staging | `staging` | Staging domain | Dedicated staging project | Anonymised copy |
| Production | `main` | Production domain | Production project | Real |

Nobody edits schema in the Supabase dashboard on staging or production. Every change is a migration file in `supabase/migrations/`, reviewed in a PR. The dashboard is read-only by convention, and the convention is enforced by drift detection (§6).

## 2. Branching and preview parity

Supabase branching creates a Postgres instance per PR with the production schema, then applies the PR's pending migrations. Vercel creates a preview deployment for the same PR. The Supabase Vercel integration syncs the preview's connection env vars.

**Two gotchas that will cost you a day each:**

1. The **Vercel GitHub integration is required** for the branching integration to work — the Supabase integration alone is not enough.
2. Sync happens when the **pull request is opened**, not when the branch is pushed. There is a race between Supabase writing the preview env vars and Vercel starting its build, so the first preview build on a new PR can connect to the wrong database. Guard against it: the app asserts at boot that `NEXT_PUBLIC_SUPABASE_URL` matches the expected environment for `VERCEL_ENV`, and refuses to start on mismatch. A preview build silently pointed at production is the worst version of this bug, because it looks like it works.

```ts
// lib/env.ts
const env = EnvSchema.parse(process.env);
if (process.env.VERCEL_ENV === 'preview' && env.NEXT_PUBLIC_SUPABASE_URL === PRODUCTION_URL) {
  throw new Error('Preview deployment is pointed at the production database. Refusing to start.');
}
```

## 3. Pipeline

```
PR opened
 ├─ ci.yml            typecheck · lint · unit · build
 ├─ db.yml            start local supabase · apply migrations · pgTAP · policy lint
 ├─ e2e.yml           playwright against the preview URL
 ├─ evals.yml         RAG golden set (only if retrieval/prompts/chunking changed)
 └─ a11y.yml          axe on key routes

merge to staging
 ├─ supabase db push --project-ref $STAGING
 └─ vercel deploy (auto)

merge to main
 ├─ supabase db push --project-ref $PROD     ← migrations BEFORE the app deploy
 ├─ vercel deploy (auto)
 ├─ smoke tests against production
 └─ tag release · Sentry release · notify
```

Migrations run before the app deploy, so every migration must be backward compatible with the currently-running app for the duration of the rollout. Additive first, always.

## 4. The security gates

These are what make the rest of the security model real rather than aspirational.

### RLS coverage — no table ships without a policy

```yaml
# .github/workflows/db.yml
- name: Every public table has RLS enabled
  run: |
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      do \$\$
      declare t record;
      begin
        for t in
          select c.relname from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
        loop
          raise exception 'Table public.% has RLS disabled', t.relname;
        end loop;
      end \$\$;"

- name: Every RLS-enabled table has at least one policy
  run: |
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
      do \$\$
      declare t record;
      begin
        for t in
          select c.relname from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname='public' and c.relkind='r' and c.relrowsecurity
            and not exists (select 1 from pg_policies p
                            where p.schemaname='public' and p.tablename=c.relname)
        loop
          raise exception 'Table public.% has RLS but no policies (denies all)', t.relname;
        end loop;
      end \$\$;"

- name: pgTAP isolation tests
  run: supabase test db
```

### Tenant isolation test — the one that matters

`supabase/tests/` contains, per building-scoped table, a test proving Manager A cannot read Building B. The suite seeds two orgs, two buildings, four users, and asserts zero rows across the boundary — including the explicit case where the attacker knows the target UUID (doc 03 §10).

### Service-role import allowlist

```json
// .eslintrc — no-restricted-imports
{ "patterns": [{
    "group": ["**/lib/supabase/admin"],
    "message": "service_role bypasses RLS. Add your file to the allowlist in lib/supabase/admin.ts and get a second reviewer."
}]}
```

With an `overrides` block permitting the enumerated files. New callers require a deliberate config change, which is visible in review.

### Secret scanning

Gitleaks on every push, plus a pre-commit hook. The v1 prototype shipped an Anthropic key path through the browser; a grep for `api.anthropic.com` outside `lib/ai/` fails the build.

## 5. Test strategy

| Layer | Tool | Covers | Gate |
|---|---|---|---|
| Unit | Vitest | Chunking, RRF merge, citation parsing, permission maps, date math (AGM/hearing deadlines) | 80% on `lib/` and `features/*/` |
| DB | pgTAP | RLS isolation, constraints, RPC authorization | 100% of building-scoped tables |
| Integration | Vitest + local Supabase | Server actions end to end with real RLS | All mutating actions |
| E2E | Playwright | Onboarding, ask→cite→verify, upload→ingest→answer, switch building, approve→send | Green on preview |
| Eval | Custom | RAG golden set, doc 04 §9 | Thresholds in doc 04 |
| A11y | axe-playwright | Chat, vault, portfolio, onboarding | Zero serious/critical |
| Load | k6 | 50 concurrent streams | P95 TTFT < 1.5 s |

### E2E scenarios that must exist

1. **Cross-building isolation, through the UI.** Log in as Manager A, ask a question whose answer exists only in Building B's bylaws, assert the answer does not contain it. Then log in as Manager B and assert it does.
2. **Switch mid-thread.** Open a thread on Building A, switch to Building B, confirm a new thread opened and the old one still shows Building A's citations.
3. **Assistant manager cannot send.** Draft a notice as `assistant_manager`, assert the Send control is absent and the direct action returns 403.
4. **Ingestion recovery.** Upload a scanned PDF, assert OCR path, assert the vault shows a real status not a stuck spinner.
5. **Citation verification.** Click a citation, assert the drawer opens with the highlighted span and the effective date.

## 6. Drift detection

Nightly, staging and production:

```bash
supabase db diff --linked --schema public > drift.sql
[ -s drift.sql ] && echo "::error::Schema drift detected" && cat drift.sql && exit 1
```

Non-empty output means someone changed the database outside migrations. Alert loudly — drift is how RLS policies get quietly disabled during a debugging session and never restored.

## 7. Environment variables

```ts
// lib/env.ts — parsed at boot, fails fast
export const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  VOYAGE_API_KEY: z.string().min(1),            // embeddings
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),
  SENTRY_DSN: z.string().url().optional(),
});
```

Only `NEXT_PUBLIC_*` reaches the browser. A lint rule fails any file importing `env.ts` from a `'use client'` module. Rotate the service role key quarterly and on any team departure.

## 8. Release and rollback

Vercel instant rollback covers the app. The database does not roll back automatically — every migration PR states its rollback plan, and destructive migrations get a paired `down` script that is tested on a staging restore before the forward migration merges.

**Incident triage order for a suspected data leak:**
1. Disable the affected feature flag (kill switch, not a deploy).
2. Query `audit_log` for the blast radius by `building_id` and time range.
3. Query `retrieval_traces` for which chunks were returned to which user.
4. Only then fix forward.

This ordering exists because the first instinct — push a fix — destroys the ability to answer "who saw what", which is the question the client and the regulator will ask.

## 9. Cost controls

- Per-org monthly token budget, soft alert at 80%, hard stop at 120% with an override.
- `claude-haiku-4-5` for titles, routing, and query expansion. Sonnet only for answers and drafting.
- Embedding cache on normalised query text, 1 h TTL.
- Alert on P95 tool-loop step count > 6 — runaway loops are the usual cause of a cost spike.
- Weekly cost-per-building report; it is also the input to pricing.
