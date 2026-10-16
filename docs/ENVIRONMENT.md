# Environment variables

Names only. Values belong in the Vercel project's environment settings, never in the repository or in chat.

The authoritative list is [lib/env-groups.json](../lib/env-groups.json). The app reads it through [lib/config.ts](../lib/config.ts), and [scripts/check-vercel-env.mjs](../scripts/check-vercel-env.mjs) reads the same file to report which names a Vercel environment defines.

## Groups

| Group | Variables | What it enables | Without it |
|---|---|---|---|
| `core` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SERVER_SIGNING_SECRET`, `NEXT_PUBLIC_APP_URL` | Database, sign-in, signed rate-limit records, absolute links | Production refuses to start (`instrumentation.ts`), naming the missing variables |
| `answers` | `GROQ_API_KEY` | Ask and drafting answers | Ask returns the service-unavailable state |
| `email` | `RESEND_API_KEY`, `EMAIL_FROM` (plus `EMAIL_MODE`, `EMAIL_STAGING_ALLOWLIST` for staging) | Invitation email with delivery status | Invitations show a copyable link only |
| `fileScan` | `FILE_SCAN_URL`, `FILE_SCAN_TOKEN` | Malware scanning before ingestion | Ingestion fails closed in production |
| `billing` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe billing | Off. Kept off for launch (decision D12) |

Optional, read where present:

- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: shared rate limits. Without them, limits use the database.
- `VOYAGE_API_KEY`: embeddings. Without it, the app falls back to its local path.
- `AI_ANSWER_MODEL`, `AI_FAST_MODEL`, `AI_STRUCTURE_MODEL`, `EMBEDDING_MODEL`: model overrides.
- `DEMO_MODE`: must be exactly `on` to expose `/demo`. Leave unset in production.
- `LEGAL_CORPUS_INGEST_ENABLED`: keep unset until counsel approves the corpus (decision D7).

## Checking a Vercel environment

```
vercel login
vercel link
node scripts/check-vercel-env.mjs production
```

The script runs `vercel env ls`, which prints names without values, and exits 1 if a production `core` name is missing. It has not been run against this project, because the Vercel CLI and its login are not available in the working environment.

## Local end-to-end runs

`npm run test:e2e:local` reads the local stack's URL and keys from `supabase status` in memory, builds the app and runs Playwright on port 3100. Playwright refuses to start if the Supabase URL is not `http://127.0.0.1:54321`, or if the port is 3000.

## Complete inventory (names read by the code, classified)

Source: a search of `app/`, `lib/`, `features/`, `inngest/`, `mock/`, `data/`, `proxy.ts`, `instrumentation.ts`, `scripts/` at the working tree. Values are never recorded here.

| Name | Class | Read by | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required at startup | app, proxy, health | Startup check (`instrumentation.ts`) fails production without it. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required at startup | app, proxy, health | Same. |
| `SUPABASE_SERVICE_ROLE_KEY` | required at startup | server modules | Server-only. Must never reach a client bundle. |
| `SERVER_SIGNING_SECRET` | required at startup | rate limiting, signed records | Signing key for consumed rate-limit records. |
| `NEXT_PUBLIC_APP_URL` | required at startup | absolute links, auth redirects | Falls back to `VERCEL_URL` when unset. |
| `GROQ_API_KEY` | required for an enabled feature (Ask/drafting) | AI routes | Without it, AI answers return the service-unavailable state. Resident-facing AI stays off (D5). |
| `AI_ANSWER_MODEL`, `AI_FAST_MODEL`, `AI_STRUCTURE_MODEL` | optional | AI routes | Model overrides. |
| `VOYAGE_API_KEY`, `EMBEDDING_MODEL` | optional | embeddings | `lib/ai/embeddings.ts` requires 1024 dimensions. Without a key the local path is used. Verify which path runs in production before claiming semantic retrieval. |
| `RESEND_API_KEY`, `EMAIL_FROM` | required for an enabled feature (invitation email) | `lib/email/invitations.ts` | Without them, invitations show a copyable link only. |
| `EMAIL_MODE`, `EMAIL_STAGING_ALLOWLIST` | required for staging email | `lib/email/invitations.ts` | Staging must restrict recipients to the allowlist. |
| `FILE_SCAN_URL`, `FILE_SCAN_TOKEN` | required for an enabled feature (ingestion) | upload pipeline | Ingestion fails closed in production when absent. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | required for an enabled feature (paid tools) | billing, Stripe webhook | Off for launch (D12). |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | optional | rate limiting | Without them, rate limits use the database function. |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | required for background jobs in production | Inngest SDK (`inngest/client.ts` sets `isDev` false in production) | Standard SDK names, not referenced by this repo. Not configured anywhere visible. Background ingestion is unverified until these are set and an Inngest run is observed. |
| `DATABASE_ENVIRONMENT`, `PRODUCTION_SUPABASE_URL` | guard | `lib/env.ts` | Preview deployments refuse a non-production database unless the URL matches. |
| `DEMO_MODE` | must be unset in production | `proxy.ts`, demo layout | Only `on` enables `/demo` and `/api/demo`. |
| `KB_DIST_DIR` | build/ingest only | `scripts/ingest-kb.ts` | Not needed at runtime. |
| `LEGAL_CORPUS_INGEST_ENABLED` | keep unset | legal corpus ingestion | Off until counsel approves (D7). |
| `VERCEL_ENV`, `VERCEL_URL` | platform-provided | `lib/env.ts` | Not configured by us. |
| `NODE_ENV` | platform-provided | several | Not configured by us. |
| `SUPABASE_URL` | test only | `features/auth/actions-role-switch.integration.test.ts` | Now refused unless local. Not a runtime variable. |
| `BASE_URL` | script only | `scripts/a11y-test.ts` | Now refused unless the local test server (port 3100). |
| `E2E_PORT` | test only | `playwright.config.ts` | Refused if 3000. |

Supabase Auth email (confirmation, password reset) uses SMTP settings in the Supabase project, not in this repository. They are not verified here.

## Requirements found during the vertical slice

- **`SERVER_SIGNING_SECRET` must equal the database's `private.runtime_secrets` row named `server_signing`.** Assistant messages are signed by the app with the environment value and verified in Postgres (`private.valid_signature`). A migration seeds that row with a random value, so unless an operator sets it to the same value in each environment, every assistant message is refused. Locally, `npm run test:e2e:local` sets a per-run value in the local database and passes the same value to the app. Hosted environments are not provisioned by this repository and need an operator step, with the value kept in the deployment secret store.
- `AI_PROVIDER=local-stub` replaces the answer models and embeddings with deterministic local stand-ins. It is refused on Vercel and against any database other than the local stack. Stub output is not production output.
- `INNGEST_DEV=1` points the Inngest SDK at the local dev server. It is refused on Vercel.
