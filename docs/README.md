# BylawIQ — Engineering Documentation

A complete build specification for BylawIQ: an AI assistant for British Columbia strata property law, grounded in each building's own registered bylaws.

Written to be read by an AI coding agent (Claude Code, Cursor, Codex) and by the humans reviewing its output.

## How to use this

1. Copy this folder to `docs/` at your repo root.
2. Copy `AGENTS.md` to the repo root and symlink it: `ln -s AGENTS.md CLAUDE.md`.
3. Point your agent at a phase in `09-BUILD-ROADMAP.md` and let it read its way in.

`AGENTS.md` is the entry point. It carries the non-negotiable rules and tells the agent which document to read for the area it is working in.

## Contents

| File | What's in it |
|---|---|
| **AGENTS.md** | Agent instructions: stack, conventions, definition of done, the things that look helpful and aren't |
| **00-PRODUCT-BRIEF.md** | Personas, jobs to be done, the single vs multi-building split, success metrics |
| **01-ARCHITECTURE.md** | Stack rationale, request lifecycle, folder structure, the three Supabase clients, caching |
| **02-DATA-MODEL.md** | Full DDL, entity map, CRUD matrix by role, migration discipline |
| **03-RBAC-SECURITY.md** | Roles, permissions, RLS policies, JWT custom claims, column grants, threat model |
| **04-AI-RAG-PIPELINE.md** | Four corpora, chunking, hybrid search with RRF, citations, as-of dating, tools, evals |
| **05-UI-UX-SPEC.md** | The two shells, left rail, composer, attachments, message thread, portfolio dashboard |
| **06-DESIGN-SYSTEM.md** | Tokens, typography, components, motion, interface writing |
| **07-API-CONTRACTS.md** | Server actions vs route handlers, Zod schemas, error mapping, rate limits, idempotency |
| **08-CICD-DEVOPS.md** | Environments, preview parity, the security gates, test strategy, drift detection |
| **09-BUILD-ROADMAP.md** | Seven phases in dependency order, with sequencing rationale |
| **10-AI-UX-PATTERNS.md** | Shape of AI pattern families mapped to this product, plus anti-patterns |
| **11-LEGAL-SAFETY.md** | Liability position, system prompt, verification gate, prompt injection, PIPA, currency |

## The three decisions everything else follows from

**1. Scope is enforced in Postgres, never in the prompt.** Retrieval runs as the authenticated user through Row Level Security. No tool accepts a building identifier — the building comes from the session. If a prompt injection tries to widen scope, there is no parameter to inject into and no rows to return. Cross-building leakage is the one failure this product cannot survive, so it is defended twice, independently.

**2. The shell is chosen by membership count, not role.** A user with one building gets a focused interface with no switcher; a user with many gets a portfolio interface where the active building is stated in three places. Role determines permissions; membership count determines shape. Conflating them gives a single-building manager an empty portfolio dashboard.

**3. The model is a writer, not a knowledge base.** Every legal claim traces to a retrieved chunk with a clickable citation. When retrieval finds nothing, the answer says so rather than producing a plausible paragraph. An unsourced legal claim is worse than no answer, because it will be sent to a resident.

## Stack

Next.js 16 App Router · Vercel AI SDK 6 · Claude Sonnet 5 · Supabase (Postgres, pgvector, Auth, Storage) · Tailwind v4 + shadcn/ui · Inngest · Vercel

## Relationship to the existing prototype

`bylawiq-v2.jsx` proved the concept and should be read for its domain content — the Strata Property Act sections, the CRT patterns, the mode structure, and the starter prompts are all worth carrying forward.

Four things in it do not survive contact with production, and each is addressed in these docs:

| Prototype | Production | Where |
|---|---|---|
| Browser calls `api.anthropic.com` directly | Server-side route with auth, rate limiting, and audit | 01 §2, 04 §8 |
| Legal knowledge baked into the system prompt | Retrieval over four corpora with citations and as-of dating | 04 |
| Bylaws pasted as text into React state | Vault with parsing, structural chunking, and versioning | 02, 04 §10 |
| Per-mode colour theming the whole interface | Colour reserved for scope and risk; mode is a small label | 06 §2 |
