# 09 — Build Roadmap

Epics in dependency order. Each is scoped to be independently mergeable and demonstrable. Estimates assume one experienced full-stack developer working with an AI coding agent.

## Phase 0 — Foundation (week 1)

| # | Epic | Done when |
|---|---|---|
| 0.1 | Repo scaffold | Next.js 16, TS strict, Tailwind v4 with doc 06 tokens, shadcn, Vitest, Playwright, ESLint with the service-role import rule. `pnpm verify` runs everything. |
| 0.2 | Supabase local + envs | `supabase start` works, three projects provisioned, Vercel connected, env schema validated at boot including the preview/production guard (doc 08 §2). |
| 0.3 | CI skeleton | `ci.yml`, `db.yml` with both RLS coverage gates passing on an empty schema. Gates exist **before** the first table. |

Do not skip 0.3. Adding the RLS gate after twenty tables exist means twenty retrofits.

## Phase 1 — Identity and tenancy (weeks 2–3)

| # | Epic | Done when |
|---|---|---|
| 1.1 | Core schema | orgs, buildings, org_members, building_members, `my_buildings` view. RLS + policies + indexes in the same migrations. |
| 1.2 | Roles and permissions | `app_role`, `app_permission`, `role_permissions` seeded. `authorize()`, `has_building_access()`, `building_role()`. `pnpm gen:permissions` emits the TS map. |
| 1.3 | Auth | Supabase Auth, custom access token hook, `requireUser`/`requireMembership`/`requirePermission`, middleware session refresh. |
| 1.4 | **RLS test harness** | pgTAP suite seeding two orgs / two buildings / four users. Isolation asserted per table, including the known-UUID attack (doc 03 §10). |
| 1.5 | Onboarding | Six steps (doc 05 §8) through building creation, including strata plan number collision handling. |
| 1.6 | Members admin | Invite, accept, role change with the four guards and session invalidation (doc 07 §5). |

**Milestone:** two managers in two orgs, neither can see the other's building. Proven by test, not by clicking.

## Phase 2 — Vault and ingestion (weeks 4–5)

| # | Epic | Done when |
|---|---|---|
| 2.1 | Storage | Private bucket, path convention, storage RLS, signed-URL download route. |
| 2.2 | Documents schema | documents, document_versions, document_chunks with hnsw + gin indexes, the building_id consistency trigger. |
| 2.3 | Ingestion pipeline | Inngest: parse → structure detect → chunk → contextual header → embed → insert → bump corpus_version. OCR fallback. |
| 2.4 | Vault UI | Upload with real staged progress, document list with type/effective date/status, retry on failure, supersede flow. |
| 2.5 | Ingestion quality | Section detection populates `section_ref`/`heading` on a test set of 10 real BC bylaw documents at >90% accuracy. |

**Milestone:** upload a real 60-page bylaw PDF, get correctly-sectioned chunks with usable citation metadata.

2.5 is the epic most likely to be underestimated. Generic splitting gives chunks that retrieve but do not quote, and unquotable chunks make the citation UI worthless.

## Phase 3 — Retrieval and chat (weeks 6–8)

| # | Epic | Done when |
|---|---|---|
| 3.1 | Legal corpus | legal_sources, legal_chunks. Seed SPA, Regulation, Standard Bylaws, Human Rights Code with `in_force_from`/`to`. |
| 3.2 | Hybrid search | `hybrid_search_building`, `hybrid_search_legal`, RRF, reranking, as-of filtering. Benchmarked P50 < 200 ms at 100k chunks. |
| 3.3 | Chat schema | chats, messages (jsonb parts), message_citations. Chat RLS including the `with check` on building scope. |
| 3.4 | Chat route | `/api/chat` with streamText, tools, server-side history, onFinish persistence, telemetry. |
| 3.5 | Chat UI | Composer with scope chips, part renderers, streaming, stop, edit-and-branch. |
| 3.6 | Citations | Marker parsing, resolution to rows, inline chips, source drawer with span highlighting. |
| 3.7 | Attachments | Vault picker, upload with ephemeral/persist choice, per-turn pinning. |
| 3.8 | Eval harness | 150-question golden set, RAGAS metrics, cross-building leak test wired into CI. |

**Milestone:** ask a question about a real building, get a cited answer, click the citation, land on the exact bylaw text. The cross-building leak test is green.

## Phase 4 — The two shells (weeks 9–10)

| # | Epic | Done when |
|---|---|---|
| 4.1 | Shell resolution | `my_buildings` count selects focused vs portfolio. Both render correctly. |
| 4.2 | Building switcher | `⌘B` palette, type-ahead on name and plan number, recents, vault dots. |
| 4.3 | Mid-thread switch | Confirmation dialog, new thread creation, optional question carry-over. `chats.building_id` immutable after first message. |
| 4.4 | Portfolio dashboard | Needs-attention list, computed deadlines (AGM from FYE, hearing from dispute events), vault completeness, building table. |
| 4.5 | Portfolio queries | `chat.use_portfolio` gated cross-building search with the amber chip and per-building attribution in results. |
| 4.6 | Thread scoping | Threads filtered to active building; "show all" reveals with building chips. |

**Milestone:** a manager with 14 buildings works a full day without once being unsure which building an answer refers to.

## Phase 5 — Disputes and documents (weeks 11–13)

| # | Epic | Done when |
|---|---|---|
| 5.1 | Disputes schema | disputes, dispute_events (append-only), stage enum, RLS. |
| 5.2 | Dispute UI | Timeline with occurred/logged distinction, stage transitions, chat linkage, s.135 deadline computation. |
| 5.3 | Draft generation | `draft_document` tool, generated_documents, revision history, template kinds. |
| 5.4 | Verification gate | Approval RPC, separation of duties, check constraint, approval UI, audit rows. |
| 5.5 | Export | PDF and DOCX with org letterhead, signature block, and the disclosure footer. |
| 5.6 | Audit log | `log_audit()`, append-only grants, audit viewer for `audit.read` holders. |
| 5.7 | Tool approval UI | `approval-requested` part renderer for `log_dispute_event` (doc 10 §4). |

**Milestone:** noise complaint → grounded answer → drafted s.135 notice → second-person approval → PDF on letterhead → logged to the dispute timeline. End to end, audited.

## Phase 6 — Currency and digest (weeks 14–16)

| # | Epic | Done when |
|---|---|---|
| 6.1 | Legislation sync | Weekly BC Laws pull, section-level diffing, re-embed changed sections, flag affected citations. |
| 6.2 | Case law sync | Daily CanLII pull for CRT/BCHRT/BCSC/BCCA strata decisions. |
| 6.3 | Digest | Per-building impact analysis, digest UI, notifications. |
| 6.4 | Currency warnings | Vault staleness detection, superseded-bylaw warnings on answers. |

## Phase 7 — Hardening (weeks 17–18)

| # | Epic | Done when |
|---|---|---|
| 7.1 | Load testing | 50 concurrent streams, P95 TTFT < 1.5 s. |
| 7.2 | A11y audit | Zero serious/critical axe findings on all primary routes; manual keyboard and screen-reader pass. |
| 7.3 | Security review | External pen test focused on tenant isolation and prompt injection. |
| 7.4 | Incident runbooks | Leak, outage, bad-answer, and PIPA-request procedures written and rehearsed. |
| 7.5 | Cost controls | Per-org budgets, alerting, cost-per-building reporting. |

## Deferred

**Phase 8+:** owner/resident read-only portal · lawyer marketplace · bylaw health scoring · anonymised benchmarking (consent required) · property-management-system connectors · email send integration · meeting agenda generation.

**Phase 9:** Ontario (*Condominium Act*, CAT tribunal) and Alberta (*Condominium Property Act*). The `jurisdiction` columns exist from day one so this is an additive corpus and prompt change, not a schema migration. Do not build any Ontario-specific logic before the BC product is validated in production.

## Sequencing notes

**Why identity before retrieval.** The tenant boundary shapes every table and every query. Building retrieval first and adding multi-tenancy after means rewriting the retrieval layer and re-testing every policy — and the version that ships in between is the one that leaks.

**Why the eval harness in Phase 3, not Phase 7.** Without it there is no way to know whether a prompt change improved or degraded the product. Retrieval changes are the highest-frequency change in an AI product and the hardest to evaluate by hand.

**Why the two shells come after chat works.** The shell distinction is meaningless until there is something to scope. Building it early produces a portfolio dashboard with nothing in it.

**Where to cut if time is short.** Phase 6 can slip — the digest is valuable but not the wedge. Phases 1–5 cannot: they are identity, grounding, and the audit trail, which are what the product is.
