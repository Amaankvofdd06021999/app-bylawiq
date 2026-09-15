# BylawIQ webapp — source snapshot

Exported 14 September 2026. This is the application code available after the coding workspace was restored. It is an implementation in progress, not a production release. The earlier marketing website is a separate project.

## Run locally

Use Node.js 22.13 or later and npm. The included `package-lock.json` is the reproducible dependency lock used by CI.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/preview/ask` to explore the fictional, read-only sample workspace. It does not need live AI credentials. Open `/login` or `/signup` for the real authentication flows once the required services are configured. Sample buttons intentionally cannot persist changes.

## What the source contains

- Next.js 16 App Router, React, strict TypeScript, Tailwind CSS, Radix UI and the BylawIQ typography and visual style.
- Supabase authentication screens and server actions, password recovery, organization onboarding, building membership, account roles, invitations and linked-account flows.
- Building, knowledge-base, agent, document, bylaw, notice, dispute and notification management; draft and approval workflows; PDF and DOCX artifact exports.
- Private conversations with persistent messages, citation drawers, scoped retrieval, generation cancellation and replay of persisted stream events.
- Configurable building agents and versioned deployments, document parsing and chunking, website ingestion, Voyage embeddings and PostgreSQL hybrid retrieval with pgvector.
- Row Level Security, live membership checks, constrained database writes, citation verification, audit records and server-attested assistant messages.
- Eight database migrations, application tests, database isolation tests, Playwright tests and the supplied product and architecture specifications.

## Service configuration

All variable names are documented in `.env.example`. Credentials are intentionally blank and must be supplied through local environment files or your hosting provider's secret settings.

| Service | Required configuration |
| --- | --- |
| Supabase | Project URL, publishable key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only service-role key for background ingestion. |
| Auth and trusted operations | `SERVER_SIGNING_SECRET` must match the database's server-signing secret. Configure this through an authorized secure process; do not commit it. Auth rate limiting uses Upstash when configured, otherwise the signed database limiter. |
| Auth delivery | Configure the site URL, allowed callback/reset URLs, email delivery and the custom access-token hook defined by the identity migration. |
| AI answers | `ANTHROPIC_API_KEY`; confirm the configured `AI_ANSWER_MODEL` is available to the account. The default model identifiers follow the supplied product specification. |
| Embeddings | `VOYAGE_API_KEY` and the model/dimension configuration in `lib/ai/embeddings.ts`. |
| Background jobs | Inngest event and signing keys; register the app's `/api/inngest` endpoint. |
| Upload scanning | `FILE_SCAN_URL` and `FILE_SCAN_TOKEN`. Production file ingestion fails closed without a scanner. The endpoint accepts file bytes and returns a JSON `clean` boolean. |
| Optional providers | Groq and Upstash variables are present for their respective integrations. |

Set `NEXT_PUBLIC_APP_URL` to the deployed app origin. Use a dedicated database for previews and set `DATABASE_ENVIRONMENT` to `preview` or `production` to match the target. Never put server-only keys into a `NEXT_PUBLIC_` variable.

## Database and deployment

The packaged migration filenames match the eight migrations already applied to the dedicated ByLaw-IQ Supabase project. The seven recovered local migration bodies were compared with the recorded cloud migration bodies; the final `security_review` migration was recovered from that history. No database rows or credential values are included.

For a new Supabase instance, initialize the Supabase CLI configuration for this directory, then apply the migrations in filename order. Configure Auth and job settings separately. If working with an existing database, review its migration history before applying anything. The archive does not include a generated `supabase/config.toml`; the database CI job needs that configuration before it can run independently.

For Vercel, import this directory as a Next.js project with `npm ci` as the install command and `npm run build` as the build command. Add the environment variables for each deployment target, configure Auth redirects and register Inngest. This source export does not itself create or confirm a Vercel deployment.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The export-time results and remaining work are in `SNAPSHOT-STATUS.md`. The Playwright tests cover the sample interface; they do not establish that live authentication, provider calls or background ingestion work end to end.

## Project map

| Directory | Purpose |
| --- | --- |
| `app/` | Pages, layouts, API routes and authentication callback. |
| `components/` | Shared shell and interface primitives. |
| `features/` | Feature screens, server actions, data access and chat orchestration. |
| `lib/` | Shared authentication, AI, security, export and database utilities. |
| `inngest/` | Background document ingestion. |
| `supabase/` | Database migrations and pgTAP tests. |
| `tests/` | Vitest and Playwright suites. |
| `docs/` | Original product brief, architecture, security, API and build specifications. |
| `public/` | Fonts and an illustrative building photograph; see asset credits. |

## Legal and product limits

The preview contains fictional buildings and examples. It is not a legal corpus. Live answers require reviewed, authorized sources. The app is designed to present applicable information for human review, not make legal determinations. No automated BC Laws/CiviX ingestion or CanLII website scraping is enabled in this snapshot. Follow the source licensing and legal requirements in the supplied specifications.
