# Deleted files review (HEAD vs working tree)

Each tracked file deleted in the working tree, with its disposition. "Required" means the product still needs the capability; the file must be rewritten against the current schema, not restored as-is. A HEAD copy exists for reference: `git show HEAD:<path>`.

## Migrations (renamed or rewritten; see [MIGRATION-RECONCILIATION.md](MIGRATION-RECONCILIATION.md))

16 files are renamed to 14-digit versions. 11 of those also change SQL. Disposition: **blocked on the migration decision**.

## Required: deleted without replacement (must be rewritten)

| Path | HEAD size | Why it matters | Disposition |
|---|---|---|---|
| `features/dashboards/queries.ts` | 696 lines | Real database reads for firm-owner, strata-manager and building-manager dashboards. The adapter's dashboard methods now return `null`. | Required. Restored copy failed typecheck with 13 errors against the current schema, so it was reverted. Rewrite against the authenticated client with typed rows. |
| `features/resident/queries.ts`, `features/resident/types.ts` | 101 lines + types | `residentHome`, the resident home data. Current resident home data is hard-coded empty. | Required. Rewrite. |
| `features/firm-kb/components/firm-kb-upload.tsx` | 409 lines | Firm-knowledge upload UI. | Required. Rewrite with the staff-document upload path. |
| `app/api/firm-kb/upload/route.ts`, `app/api/firm-kb/[id]/route.ts` | — | Firm-knowledge upload and item routes. Nothing references them now. | Required. Rewrite behind the authenticated, permission-checked upload path. |
| `features/auth/actions-role-switch.test.ts` | — | Unit test of role switching. The integration replacement is excluded from the default run, so role switching has no active test. | Required. Replace with an active test. |

## Intentional (superseded or dead)

| Path | Disposition |
|---|---|
| `app/(app)/firm/chat/page.tsx`, `app/(app)/portfolio/chat/page.tsx` | Removed earlier. Chat is per building; no references remain. Intentional. |
| `app/(app/)/admin/billing/page.tsx`, `buildings/page.tsx`, `team/page.tsx` | Removed. The `(app/)` folder had a stray slash; the live pages are under `app/(app)/admin/`. Intentional. |
| `features/admin/components/pending-invitations.tsx` | Replaced by `pending-invitations-table.tsx`. Intentional. |
| `features/residents/verification-gate.ts` | Moved to `features/chat/resident-verification-gate.ts`. Confirm the moved gate covers every resident-facing answer path before relying on it (AGENTS §4). |
| `features/chat/multi-role-chat*.ts`, `features/chat/components/multi-role-chat.tsx` | Multi-role chat removed. Intentional, unless the product still needs it. Confirm. |
| `features/residents/resident-chat-*.ts`, `resident-chat-gated*.tsx`, `resident-chat-ui.tsx`, `resident-chat-schema.ts` | Resident AI chat. Disabled by decision D5 until counsel approval. Intentional. |
| `e2e/bulletin.spec.ts`, `e2e/chat-rag.spec.ts` (root `e2e/`) | Duplicates of `tests/e2e`, which had `fixme` markers. Intentional. |
| `supabase/tests/bulletin_rls.test.sql`, `rls_dashboards.test.sql`, `rls_firm_knowledge.test.sql`, `rls_session_role.test.sql` | Never valid: non-UUID fixtures and invalid SQL. Intentional. Equivalent coverage must be re-written (item 4). |
| `test/setup.ts` | No config references it; Vitest uses `@testing-library/jest-dom/vitest`. Intentional. |

## Restored in this review

None kept. Three restored copies failed typecheck and were reverted to the deleted state, so the typecheck gate stays green. Each stays a "required" row above until rewritten.
