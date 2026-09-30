# Tools

Run from `kb/` (or with `pnpm --dir kb <script>` from anywhere).

| Script | What it does |
|---|---|
| `pnpm validate` | Checks every item and `source.json`. Exits 1 on errors. |
| `pnpm build` | Validates, then writes `dist/` with every item, drafts included (demo). |
| `pnpm build:prod` | Same, approved items only (production). |
| `pnpm test` | Unit tests for the validator and chunker (`node:test` via `tsx --test`). |
| `pnpm typecheck` | Type-checks the tools. |

`lib/kb.ts` holds loading and validation, `lib/chunk.ts` holds chunking. Both depend only on Node built-ins and `yaml`.
