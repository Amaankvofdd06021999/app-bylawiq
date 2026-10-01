# Licensing and source-access register

Status: draft. Reviewed by: null. Reviewed at: null. This register records research findings and the supplied operating plan’s restrictions. It is not a legal opinion on every reuse scenario.

| Source class | What this research established | Production handling |
|---|---|---|
| BC legislation | King’s Printer Licence v1.1 permits reproduction and commercial use subject to conditions and attribution | Preserve required notice and source/version; separately resolve permitted automated access |
| BC Laws website access | Robots.txt returned `User-agent: *` with `Disallow: /` | Do not automate downloads through that blocked route; obtain an approved export/feed or permission |
| BCSC/BCCA decisions | Supplied plan blocks text storage; full current court terms could not be retrieved | Metadata only after verification; summaries remain gated by C3 approval/permission |
| CRT decisions | Decision portal returned 403; reuse remains unverified under the plan | Stop that retrieval route; no text or summaries acquired; no invented candidates |
| CanLII | User’s plan expressly prohibits fetching, reading, scraping or storing its content | No CanLII requests; links appearing in official guidance were not followed |
| Provincial explanatory guidance | Official passages were read; general copyright page repeatedly failed | Short original research and links only here; do not assume legislation licence covers bulk guidance reuse |
| CRT/BCHRT rules and guidance | Official indexes and relevant passages were read | Verify separate storage/embedding/redistribution rights; distinguish rules from legislation |
| LTSA records and guidance | Official acquisition guidance was read; registry documents were not bought or downloaded | Obtain authorized records and respect service terms and document-specific access |
| BCFSA materials | Relevant official guidance was read | Original research only here; verify rights before importing a document corpus |
| OIPC guidance | Relevant guide was found in indexes, but attempted document URLs returned 404 | Treat substantive privacy-guide coverage as unresolved; do not promote snippets |
| BylawIQ original material | Product specifications and drafting briefs written in this pack | Original writing does not grant rights to underlying source text |
| Building/firm documents | No private building or firm records supplied | Require authority, purpose, access rules and retention controls before ingestion |

Sources: [King’s Printer Licence](https://www.bclaws.gov.bc.ca/standards/Licence.html); [BC Courts terms URL, full retrieval unresolved](https://www.bccourts.ca/Privacy%20Statement.html); [CRT decisions portal, access blocked](https://decisions.civilresolutionbc.ca/crt/en/nav.do); [Province copyright URL, retrieval unresolved](https://www2.gov.bc.ca/gov/content/home/copyright). The decision permission restriction also comes directly from the supplied operating plan, especially C3.

## Required legislation attribution

The licence prescribes the following notice for derived materials. This quotation reproduces the licence’s required attribution language under its reuse permission:

> These materials contain information that has been derived from information originally made available by the Province of British Columbia at: http://www.bclaws.gov.bc.ca and this information is being used in accordance with the King's Printer Licence – British Columbia available at: https://www.bclaws.gov.bc.ca/standards/Licence.html. They have not, however, been produced in affiliation with, or with the endorsement of, the Province of British Columbia and THESE MATERIALS ARE NOT AN OFFICIAL VERSION.

The licence distinguishes prescribed form content from a provider’s fillable-form implementation. Do not treat permission to reproduce statutory wording as permission to copy every downloadable form product.

## Method and access observations

Research used the web search/open connector to discover and read official sources. It does not expose caller-set User-Agent or its complete robots handling. Accordingly, this work does not certify the compliance of a future production crawler. The BC Laws robots file was separately checked using the operating plan’s specified identifying User-Agent; once its general prohibition was observed, automated legislative download/import was not continued. An earlier SPA consolidation and licence had already been read.

The CRT decision host’s 403 was not worked around with another browser, proxy or impersonated crawler. Some government pages returned transient 502 errors and were read on a later retry. OIPC URLs returned 404. Court terms timed out. Search snippets, failed fetches and index-only discoveries are separately labeled in source-register.json.

Only brief original research notes and source metadata are bundled. Raw guidance, tribunal decisions, court decisions and cache contents are excluded. None of the incomplete decision queues is represented as completed work.

## Permission evidence to record

Before production ingestion, store the publisher, exact source/corpus, permission document or licence version, request/response date, permitted storage and commercial uses, embedding/search rights, redistribution limits, required attribution, automation conditions, expiry/revocation terms and responsible reviewer. Keep sensitive correspondence in an appropriate internal workspace, with a non-sensitive permission reference in the source register.

No permission requests, emails, subscriptions, document purchases or third-party messages were sent during this session.
