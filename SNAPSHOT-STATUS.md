# Source snapshot status

Date: 2026-09-14.

## Recovery boundary

This package contains the source files actually available after the interrupted coding workspace returned. Several later files described earlier in the conversation were absent from the restored directory, including the OCR helper, final browser screenshots and later interface refinements. They are not represented as included or verified here. The applied database security migration was recovered separately from Supabase's migration history.

## Verification for this export

- TypeScript strict checking: passed.
- ESLint: no errors; two existing warnings in linked-account navigation and resource rendering.
- Vitest: all 60 tests passed, including database isolation and guardrail tests.
- Production build: see `verification/build-result.txt`.
- Desktop/mobile browser suites are included but were not rerun for this export. Earlier browser results from the interrupted workspace do not certify this restored snapshot.
- ZIP paths and CRC integrity are checked before delivery. An inventory with SHA-256 hashes is included as `SOURCE-MANIFEST.json`.

## Remaining setup and implementation

- Live email authentication, the cloud Auth hook, server signing, AI providers, Inngest and malware scanning still need configuration and end-to-end verification. A prior automatic approval review blocked access to the server-signing credential; this export does not read or include that credential.
- This snapshot detects scanned PDFs but does not contain the later OCR implementation. Upload searchable PDFs until OCR is restored and tested.
- Stream events can be replayed after a client reconnect. A provider generation is not durably resumed after the hosting process dies.
- The LTO amendment consolidation pipeline, licensed shared legal corpus, automatic legal updates, municipal coverage, billing and full usage/cost budgets remain unfinished.
- Edited bylaws are not automatically reindexed. A reviewed consolidated source must be ingested before retrieval uses the updated text.
- The bylaw and notice tools support manual drafting and review workflows; the complete guided builders and all AI drafting actions from the PRD are not finished.
- Full multi-role authenticated browser testing, live upload-to-answer testing, legal expert evaluation, load testing and an independent security review remain outstanding.
- The supplied specs reference `05-UI-UX-SPEC.md` and `06-DESIGN-SYSTEM.md`, but these files were not among the provided attachments.

Read `README.md` for setup and `docs/` for the intended product scope. Do not interpret the product specifications as a list of completed features.
