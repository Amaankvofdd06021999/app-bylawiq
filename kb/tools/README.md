# Tools

Run from `kb/` (or with `pnpm --dir kb <script>` from anywhere).

| Script | What it does |
|---|---|
| `pnpm validate` | Checks every item and `source.json`. Exits 1 on errors. |
| `pnpm build` | Validates, then writes `dist/` with every item, drafts included (demo). |
| `pnpm build:prod` | Same, approved items only (production). |
| `pnpm test` | Unit tests for the validator and chunker (`node:test` via `tsx --test`). |
| `pnpm typecheck` | Type-checks the tools. |
| `pnpm link:cites` | Fills `cites[]` on Act, Regulation and Schedule items from the cross-references in their own text. Reports by default; `--write` applies, `--details` lists every reference it could not cite. Re-run after `import:bclaws`. |
| `pnpm import:bclaws` | Fetches the Strata Property Act (with the Schedule of Standard Bylaws) and the Strata Property Regulation from the BC Laws CiviX document endpoints and rewrites their items and `source.json`. `--offline` rebuilds from `kb/.cache/bclaws/`. See `law/bc/acts/strata-property-act/README.md`. |

`lib/kb.ts` holds loading and validation, `lib/chunk.ts` holds chunking. `lib/xml.ts` is a small strict XML parser and `lib/bclaws.ts` converts BC Laws XML to section Markdown (both pure, tested in `bclaws.test.ts`); `lib/bclaws-topics.ts` holds the topic tags the importer applies; `lib/cites.ts` reads statute cross-references and resolves them to item ids (tested in `cites.test.ts`). Everything depends only on Node built-ins and `yaml`.
