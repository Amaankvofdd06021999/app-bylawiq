# BylawIQ — Build Prompts

Paste-ready prompts for Claude Code, Cursor, or Codex. Use the **Master Prompt** once to kick off, then one **Phase Prompt** per work session.

---

# PART 1 — Master Prompt

> Paste this as your first message in a fresh session, with `docs/` present in the repo.

```
You are the lead engineer building BylawIQ, a production AI application for
British Columbia strata property law. I am the product owner.

READ FIRST, IN THIS ORDER
  docs/BYLAWIQ-PRD-v3.md   — what we are building and why
  AGENTS.md                — how you work in this repo
  docs/01-ARCHITECTURE.md  — system shape
  docs/03-RBAC-SECURITY.md — the security model

Then read the doc matching whatever you are about to build. Do not skip this
and do not skim. These documents encode decisions that are expensive to
reverse, and several of them contradict what you would otherwise assume.

WHAT BYLAWIQ IS
A system of record for strata bylaws. Managers create, amend, adopt, and file
bylaws in it; ask questions answered from their own building's bylaws plus the
provincial and municipal law that applies at their address; draft enforcement
notices generated from their bylaw text; and get told when a bylaw needs to
change because the law moved.

THE THREE RULES THAT OVERRIDE EVERYTHING

1. SCOPE IS ENFORCED IN POSTGRES, NEVER IN THE PROMPT.
   Every retrieval query runs as the authenticated user through Row Level
   Security. No AI tool accepts a building_id parameter — the building comes
   from the server-side session. If a prompt injection tries to widen scope,
   there is no parameter to inject into and no rows to return. A user seeing
   another building's bylaws ends this product.

2. THE MODEL IS A WRITER, NOT A KNOWLEDGE BASE.
   Every legal claim traces to a retrieved chunk with a clickable citation.
   When retrieval finds nothing, the answer says so. Never let the model fill
   a gap from training data — an unsourced legal claim gets sent to a resident
   and cited at a tribunal.

3. NOTHING REACHES A RESIDENT WITHOUT A HUMAN APPROVING IT.
   Every AI output is a draft. Approval is enforced by a database check
   constraint and a SECURITY DEFINER RPC, not by a UI check.

THREE ACCOUNT TYPES — this shapes the whole app
  · Admin                   — org-wide, all buildings, billing
  · Multi-building manager  — many buildings, switcher, portfolio dashboard
  · Single-building manager — EXACTLY ONE building, no switcher

  A person managing three buildings as a single-building manager holds three
  separate accounts with three separate logins. This is deliberate: it makes
  cross-building leakage structurally impossible for that user. It ships with
  three mitigations that are not optional — plus-addressing at signup, linked
  accounts with one-click switching (switching, never merging), and a
  conversion prompt when an admin invites the same email to a second building.
  See PRD §3.3.

TWO MODEL TIERS
  Groq   — routing, query expansion, reranking, the compliance linter,
           document structure detection, notification fan-out, titles.
  Claude — legal answers, bylaw drafting, notice drafting, risk assessment,
           notification explanations.

  The rule: if a wrong output could end up in a legal document or a legal
  claim, it runs on Claude. Model IDs live in ONE file, lib/ai/models.ts.
  Groq deprecates models frequently; never pin an id anywhere else.

HOW WE WORK
  · One phase at a time, from docs/09-BUILD-ROADMAP.md and PRD §14.
  · Before writing code: state your plan, the files you will touch, and any
    assumption you are making. Wait for my go-ahead.
  · TypeScript strict. No `any`. Zod at every boundary.
  · Every new table ships in the same migration as its RLS policies, its
    indexes on policy predicates, and a pgTAP test proving isolation.
  · Every server action starts with: requireUser → schema.parse →
    requirePermission. All three, in that order.
  · Loading, empty, and error states for every async surface. None optional.
  · If a spec is ambiguous about what the law requires, do not guess and do
    not have the model guess. Leave // TODO(legal):, implement the
    conservative path, and tell me.

DO NOT
  · Call any model provider from the browser.
  · Use the service_role key in response to user input.
  · Cache anything retrieval-adjacent without building_id in the key.
  · Make the legal disclaimer dismissible.
  · Substitute a library or service for one specified in AGENTS.md §2.
  · Write SELECT * in application queries.

Start by reading the documents. Then tell me: what you understand the product
to be in three sentences, which phase you think we should start with, and the
three things in the docs you think are most likely to cause trouble.
Do not write code yet.
```

---

# PART 2 — Phase Prompts

One per session. Each assumes the master prompt has been run.

## Phase 0 — Foundation

```
Phase 0 from docs/09-BUILD-ROADMAP.md. Scaffold only, no features.

  · Next.js 16 App Router, TypeScript strict, pnpm
  · Tailwind v4 with the @theme token block from docs/06-DESIGN-SYSTEM.md §2–4
  · shadcn/ui, restyled to those tokens — do not ship default shadcn styling
  · Vitest, Playwright, ESLint including the no-restricted-imports rule
    blocking lib/supabase/admin per docs/08-CICD-DEVOPS.md §4
  · lib/env.ts with the Zod schema AND the preview/production guard from
    docs/08 §2 — a preview build pointed at the production database must
    refuse to start
  · lib/ai/models.ts with both provider tiers wired, PRD §9.2
  · Supabase local, three projects, Vercel connected
  · .github/workflows/ci.yml and db.yml with BOTH RLS coverage gates passing
    on an empty schema

The RLS gates must exist before the first table. Adding them after twenty
tables means twenty retrofits.

Done when `pnpm verify` runs typecheck, lint, test, and build clean, and
db.yml passes against an empty schema.
```

## Phase 1 — Identity and the three account types

```
Phase 1. The tenant boundary. Read docs/02-DATA-MODEL.md and
docs/03-RBAC-SECURITY.md fully, plus PRD §3.

  1. Schema: organizations, buildings, org_members, building_members,
     accounts with account_type ('admin' | 'multi_building' | 'single_building'),
     account_links. RLS + policies + indexes in the same migrations.
  2. app_role, app_permission, role_permissions seeded per PRD §3.5.
     authorize(), has_building_access(), building_role().
  3. Custom Access Token Hook injecting org_id, account_type, and the
     building→role map into app_metadata. Never user_metadata.
  4. requireUser / requireMembership / requirePermission using getClaims(),
     not getSession().
  5. Single-building constraint: a single_building account can hold exactly
     one active building_members row. Enforce with a database constraint, not
     application logic.
  6. Account linking: verified link between accounts one person controls,
     one-click switch via short-lived exchange token. Switching only.
     No screen shows two buildings. No query spans them.
  7. Signup choosing account type; plus-addressing normalisation.
  8. Invitation collision: inviting an email that already has a
     single_building account to a second building offers convert-or-separate
     with the trade-off stated.
  9. pgTAP suite: two orgs, two buildings, four users, isolation asserted per
     table INCLUDING the case where the attacker knows the target UUID.

Milestone: two managers in two orgs, neither can see the other's building,
proven by test rather than by clicking. A single-building manager holding two
linked accounts can switch in one click and cannot see both at once.
```

## Phase 2 — Documents

```
Phase 2. Read docs/02-DATA-MODEL.md §3 and docs/04-AI-RAG-PIPELINE.md §10.

  · Private Supabase Storage bucket, path vault/{building_id}/{document_id}/
    so the RLS policy extracts building_id from the first path segment
  · documents, document_versions, document_chunks with hnsw + gin indexes and
    the building_id consistency trigger
  · Inngest pipeline: parse → structure detect (Groq) → chunk → contextual
    header → embed → insert → bump corpus_version. OCR fallback for scans
  · Documents UI: upload with REAL staged progress (Uploading → Reading →
    Finding sections → Indexing → Ready), not a spinner. Failures show the
    actual reason and a retry
  · Signed URL download route, 300 s TTL, permission checked

Chunks carry heading, section_ref, page_from, page_to, effective_date.
Chunks without citation metadata are not quotable, and unquotable chunks make
the entire citation feature worthless.
```

## Phase 3 — Bylaw structure

```
Phase 3. The bylaw tree. PRD §6.1.

  · bylaw_sets, bylaw_parts, bylaw_nodes, bylaw_node_versions. Every node has
    a stable id, version history, effective_date, status, lto_filing_ref
  · Parse an uploaded bylaw PDF into the tree using Groq structure detection
  · HUMAN CONFIRMATION SCREEN — the manager reviews the detected structure
    before it is accepted. Never auto-accept the parse for the document the
    whole product depends on
  · Browse the in-force set as a tree, with status and effective dates
  · Full version history with per-node diffs

Test against 10 real BC bylaw PDFs. Section detection accuracy > 90% before
this phase is done.
```

## Phase 4 — Ask BylawIQ

```
Phase 4. Read docs/04-AI-RAG-PIPELINE.md and docs/07-API-CONTRACTS.md.

  · hybrid_search_building and hybrid_search_legal: BM25 + vector, RRF k=60,
    over-retrieve 30-40, rerank to 8-10 on Groq. NOT security definer —
    RLS must still apply
  · chats, messages (jsonb parts), message_citations
  · /api/chat: streamText, Node runtime, maxDuration 300, tools built with
    NO building_id in any input schema, history loaded server-side
  · Chat UI from docs/05-UI-UX-SPEC.md: part renderers, streaming, stop,
    edit-and-branch
  · Citations: markers parsed on finish, resolved to rows, inline chips,
    source drawer with the cited span highlighted
  · The multi-level scope selector, PRD §9.4 — chips, not a form. Level 2
    hidden entirely for single-building accounts
  · Eval harness: 150-question golden set, RAGAS metrics, cross-building leak
    test wired into CI

Milestone: ask about a real building, get a cited answer, click a citation,
land on the exact bylaw node. Leak test green.
```

## Phase 5 — Jurisdiction knowledge base

```
Phase 5. PRD §5. This is the layer most likely to be built too optimistically.

  · jurisdictions table with the hierarchy and a coverage column
    (full | partial | linked | none)
  · Address → geocode → jurisdiction_chain on the building record, with
    manual override and an audit record
  · BC Laws CiviX API ingestion for provincial legislation
  · Tier 1 municipal adapters for Metro Vancouver and the CRD
  · Retrieval filtered by jurisdiction_id = any(building.jurisdiction_chain)
  · COVERAGE INDICATORS shown wherever municipal law affects an answer

BC municipal bylaws are not centrally published — no Gazette, no registrar,
no complete API. We cannot promise complete coverage and must never imply it.
An answer depending on municipal law in a partial or linked municipality says
so explicitly and does not guess. Build the coverage indicator BEFORE the
first adapter, so there is never a version that silently overstates coverage.
```

## Phase 6 — Bylaw editor and the linter

```
Phase 6. PRD §6.2–6.5. The heart of the product.

  · Create flow: Standard Bylaws | template | copy from another building
    (portfolio/admin only) | blank. Section-by-section drafting on Claude
  · Edit flow: amendment drafts, side-by-side diff, redline. The in-force
    version is NEVER mutated
  · COMPLIANCE LINTER on Groq, sub-500ms, running on editing pause.
    All checks in PRD §6.4. Blockers prevent proposing; overrides require a
    typed justification that is recorded and shown to the reviewing lawyer
  · Deterministic fallback: fine caps, rental restrictions, and vote
    thresholds are pure logic. If Groq is down the linter degrades, never
    disappears
  · Lifecycle: draft → in_review → proposed → voted → adopted → filed →
    in_force, with the 3/4 threshold check (s.53)
  · THE UNFILED-ADOPTION WARNING. A bylaw is not effective until filed at
    the LTO (s.128). From the moment a bylaw is adopted with no filing
    reference, raise a persistent escalating notification. This single
    behaviour may prevent more CRT losses than the entire Q&A feature

Test the linter against real bylaws containing known violations: a $500 fine,
a post-Bill-44 rental restriction, a pet ban with no service-animal exception.
```

## Phase 7 — Legal review

```
Phase 7. PRD §7. Requirement: after ANY bylaw edit, suggest a lawyer.

  · Risk scoring on Claude, driven by linter findings, overrides used, and
    bylaw category
  · Review panel at the propose step. Prompt strength scales with risk.
    Never a modal that blocks work
  · Review packet PDF: current vs proposed, every finding with its statutory
    basis, overrides with justifications, building profile, municipal extract,
    and generated questions for counsel
  · CBA-BC referral (1-800-663-1919), counsel invitation as external_counsel
    with a time-boxed expiry on the membership row
  · "Proceed without review" recorded on the bylaw history and in the audit log

No marketplace in this phase. Referral, packet, and invitation cover the
requirement without the operational burden.
```

## Phase 8 — Notices

```
Phase 8. PRD §10.

  · Notices generated FROM the bylaw tree, citing the specific node in the
    version in force on the date of the conduct
  · Templates: complaint acknowledgement, contravention notice, hearing
    invitation, hearing decision, fine notice, demand, council report, CRT pack
  · FINE AMOUNTS VALIDATED AGAINST THE BUILDING'S OWN BYLAW, not the statutory
    maximum. If Bylaw 5.1 says $50, the notice says $50 even though the Act
    permits $200. Pure data check, most common source of overturned fines
  · draft → review → approve → send, with the DB check constraint and the
    approval RPC from docs/03 §5. Separation of duties on s.135 notices
  · Export with letterhead, signature block, and the disclosure footer
  · Every send logged to the dispute timeline with occurred_at separate from
    logged_at
```

## Phase 9 — Updates

```
Phase 9. PRD §8. The retention mechanism.

  · Change detection: provincial diff (weekly), municipal diff (per adapter),
    tribunal decisions (daily)
  · Matching: change → affected buildings by jurisdiction_chain → affected
    bylaw nodes by semantic + topical match. Fan-out on Groq, batch API
  · Risk assessment and the human-facing explanation on Claude
  · All nine notification types in PRD §8.1. Types 4 (unfiled adoption) and
    8 (compliance drift) first — highest value, least served by the market
  · Notification anatomy: what changed → which of YOUR bylaws → the risk →
    what to do. "Draft the amendment" opens the editor pre-filled with the
    linter already run
  · Lifecycle: new → viewed → actioned | dismissed | snoozed, with dismissal
    reasons captured as a tuning signal
  · Weekly digest, immediate email for blockers, portfolio roll-up

PRECISION OVER RECALL. A manager who dismisses three irrelevant notifications
stops reading the fourth. Do not launch this phase below 85% relevance on the
test set. Log near-misses rather than sending them.
```

---

# PART 3 — Working Prompts

Short prompts for common sessions.

**Reviewing agent work:**
```
Review the diff against docs/. For each file: does it satisfy the Definition
of Done in AGENTS.md §4? Flag specifically — missing RLS policy, missing index
on a policy predicate, missing pgTAP test, a server action missing one of the
three opening guards, an async surface missing a loading/empty/error state, a
hex literal instead of a token, or a model id outside lib/ai/models.ts.
```

**Before merging anything touching retrieval:**
```
Run the eval suite. Report faithfulness, context precision, context recall,
citation resolvability, and the cross-building leak count. If leak count is
above zero, stop and show me the failing case before doing anything else.
```

**Adding a table:**
```
Add table X. In ONE migration: the table, enable row level security, every
policy, indexes on every column referenced in a policy predicate, and column-
level grants if any column should not be client-writable. Then the pgTAP test
proving a user from Building A cannot read Building B's rows, including the
known-UUID case. Then the TypeScript types and the Zod schema.
```

**When the agent proposes a shortcut:**
```
Check that against AGENTS.md §5 — things that look helpful and are not. If it
is listed there, explain why you proposed it anyway. If it is not listed but
weakens tenant isolation, the citation guarantee, or the approval gate, treat
it as if it were.
```

**Debugging a wrong answer:**
```
Pull the retrieval trace for this message. Show me: the scope that was applied,
what each corpus returned, the RRF scores, what the reranker kept and dropped,
and the final context. Tell me whether this was a retrieval failure (the right
chunk was never retrieved) or a generation failure (it was retrieved and
ignored). Do not propose a prompt change until you have answered that.
```
