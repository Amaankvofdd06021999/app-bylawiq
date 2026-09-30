# Open questions

Questions that block or shape research. Add the date you raised it and who owns the answer. Move answered questions to the bottom with the answer and the date.

## Open

| # | Question | Blocks | Owner | Raised |
|---|---|---|---|---|
| 1 | Do the BC Laws (King's Printer) terms let us store and show verbatim consolidated statute text inside a commercial product? What attribution and disclaimer wording is required? | R2, R3 | Licensing researcher | 2026-09-30 |
| 2 | Do CRT decision reuse terms permit storing full text, or only summaries plus a link? Are there restrictions on showing party names? | R4 | Licensing researcher | 2026-09-30 |
| 3 | Same question for BC Supreme Court and Court of Appeal judgments, including how to detect and respect publication bans. | R4 | Licensing researcher | 2026-09-30 |
| 4 | Who is our reviewing counsel for firm templates and topic guides, and what sign-off form do they want recorded in `reviewed_by`? | R5, R6 | Product | 2026-09-30 |
| 5 | How do we represent past versions of a section (point-in-time law)? One item per version linked by `supersedes`, or one item with dated sub-sections? Current plan: one item per version, `in_force_to` set on the old one. | R2, R8 | Engineering and legal | 2026-09-30 |
| 6 | `legal_sources` in the app has no column for the kb item id. Ingestion needs a stable key to upsert against (proposal: add `kb_id text unique` in a migration before `--apply` is used). | App ingestion | Engineering | 2026-09-30 |
| 7 | Should topic guides and the firm and building starter kits be loaded into `legal_sources`, or into separate tables? They are not law, and the citation UI must not present them as law. | App ingestion | Engineering and product | 2026-09-30 |
| 8 | The app embeds with `voyage-law-2` (`lib/ai/embeddings.ts`) into `legal_chunks.embedding vector(1024)`, but doc 02 shows `vector(1536)`. Confirm the model and dimension, and whether to embed a contextual header (title, section path, date) with each chunk as doc 04 section 3 recommends. The ingest script needs this before `--apply` can write chunks. | App ingestion | Engineering | 2026-09-30 |

## Answered

None yet.
