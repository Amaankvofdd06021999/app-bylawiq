# BylawIQ webapp

An AI assistant for British Columbia strata property law. Implementation in progress, not a production release. **Start with [`docs/HANDOFF.md`](docs/HANDOFF.md)**: current status, how the code is organized, and how to connect the database. The earlier marketing website is a separate project.

## Run locally

Use Node.js 22.18 or later and npm. The included `package-lock.json` is the reproducible dependency lock used by CI.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set `DEMO_MODE=on` in `.env.local`, then open `http://localhost:3000/demo` to use the interactive demo: five sample people, sample buildings and documents, an in-memory store per browser session, and no model calls or live credentials. Open `/login` or `/signup` for the real authentication flows once the required services are configured.

## What the source contains

- Next.js 16 App Router, React, strict TypeScript, Tailwind CSS, Radix UI and the BylawIQ typography and visual style.
- Supabase authentication screens and server actions, password recovery, organization onboarding, building membership, account roles, invitations and linked-account flows.
- Building, knowledge-base, agent, document, bylaw, notice, dispute and notification management; draft and approval workflows; PDF and DOCX artifact exports.
- Private conversations with persistent messages, citation drawers, scoped retrieval, generation cancellation and replay of persisted stream events.
- Configurable building agents and versioned deployments, document parsing and chunking, website ingestion, Voyage embeddings and PostgreSQL hybrid retrieval with pgvector.
- Row Level Security, live membership checks, constrained database writes, citation verification, audit records and server-attested assistant messages.
- Role home screens (platform admin, firm owner, strata manager, building manager), a resident's paid tools, firm knowledge and answers grouped by knowledge layer — in the demo today; `docs/HANDOFF.md` lists what each needs in the database.
- The knowledge base in `kb/`: the Strata Property Act, Regulation and prescribed forms, standard bylaws, topic guides, eval sets and firm/building starter kits, all as drafts awaiting counsel review.
- Database migrations (21), application tests, database isolation tests, Playwright tests and the supplied product and architecture specifications.

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

The first eight migration filenames match the migrations already applied to the dedicated ByLaw-IQ Supabase project. The seven recovered local migration bodies were compared with the recorded cloud migration bodies; the final `security_review` migration was recovered from that history. No database rows or credential values are included.

For a new Supabase instance, initialize the Supabase CLI configuration for this directory, then apply the migrations in filename order. Configure Auth and job settings separately. If working with an existing database, review its migration history before applying anything. The archive does not include a generated `supabase/config.toml`; the database CI job needs that configuration before it can run independently.

For Vercel, import this directory as a Next.js project with `npm ci` as the install command and `npm run build` as the build command. Add the environment variables for each deployment target, configure Auth redirects and register Inngest. This source export does not itself create or confirm a Vercel deployment.

## Checks

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
E2E_START=1 E2E_PORT=3107 DEMO_MODE=on npm run test:e2e
```

The Playwright tests drive the demo; they do not establish that live authentication, provider calls or background ingestion work end to end. Current status and known gaps are in `docs/HANDOFF.md`.

## Project map

| Directory | Purpose |
| --- | --- |
| `app/` | Route files (thin: pick a data source, render a screen), API routes and the auth callback. `app/demo/` and `app/api/demo/` are the demo. |
| `app/_screens/` | The pages, written once against the `DataSource` contract and shared by the real app and the demo. |
| `features/` | Feature UI (`components/`, presentational, never fetch), real server actions and queries. |
| `components/` | Shared shell, UI primitives and the client-side write seam (`backend.tsx`). |
| `data/` | The `DataSource` read contract and its Supabase implementation. |
| `mock/` | The demo's data: seed, in-memory store, RLS-mirroring rules, demo actions and API. |
| `lib/` | Shared auth, AI, security, export, error and schema utilities. |
| `inngest/` | Background document ingestion. |
| `supabase/` | Database migrations and pgTAP tests. |
| `kb/` | The knowledge base package: BC strata law, starter kits, topic guides, evals and their tooling. |
| `scripts/` | `ingest-kb.ts`, which loads the built knowledge base into the legal corpus (`npm run kb:ingest`). |
| `tests/` | Vitest and Playwright suites. |
| `docs/` | Product and engineering specifications, and the developer handover. |
| `public/` | Fonts and an illustrative building photograph; see asset credits. |

## Legal and product limits

The preview contains fictional buildings and examples. It is not a legal corpus. Live answers require reviewed, authorized sources. The app is designed to present applicable information for human review, not make legal determinations. The app does not fetch BC Laws/CiviX or CanLII at runtime; legislation reaches the legal corpus only through the reviewed `kb/` build and `scripts/ingest-kb.ts`. Follow the source licensing and legal requirements in the supplied specifications.
