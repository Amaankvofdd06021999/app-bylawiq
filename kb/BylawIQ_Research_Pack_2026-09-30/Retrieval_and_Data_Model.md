# Retrieval and data model design

Status: draft. Reviewed by: null. Reviewed at: null. This file contains product and engineering recommendations, not claims that the current app implements them.

## Keep the four layers, with explicit source types

| Layer | Purpose | Retrieval boundary |
|---|---|---|
| Law | Versioned legislation and permitted decision summaries | Jurisdiction, authority, effective version and review state |
| Topic | Original explanations grounded in law items | Only approved topic and supporting source versions |
| Building | Actual building documents plus clearly labeled generic starter notes | Authorized building, section, document and user role |
| Firm | Internal policies, templates and practice guidance | Firm staff and specifically authorized internal roles |

The starter kit is not the actual building corpus. A generic note must never be silently substituted for a registered clause. Evaluation files are a separate non-retrieved store, including fixtures and answer keys. Research notes and candidate queues should also remain outside public retrieval.

Avoid changing the existing schema before reading README.md. Preserve its required frontmatter exactly. Use a source-sidecar manifest for proposed extra fields until a schema extension is approved.

## Proposed provenance sidecar

| Group | Suggested fields | Reason |
|---|---|---|
| Source | publisher, canonical_url, source_type, official_or_secondary, instrument_title | Establish what the source is and its authority |
| Passage | document_id, version_id, provision/paragraph/page, heading_path, character offsets | Resolve a citation to the passage actually relied on |
| Dates | retrieved_at, publisher_date, consolidation_through, effective_from, effective_to, decision_date | Avoid substituting retrieval or publication dates for legal effect |
| Version | content_hash, prior_version_id, amendment/commencement evidence, supersession_reason | Reproduce an answer and preserve history |
| Rights | licence_id, attribution_text, commercial_use, verbatim_storage, embedding_use, redistribution, access_basis, permission_evidence | Keep licence rights distinct from access permission |
| Access | firm_id, building_id, section_id, document_acl, sensitivity, purpose | Enforce boundaries before search |
| Quality | extraction_method, OCR_confidence, formula/table_review, unresolved_conflict, reviewer_state | Prevent unreliable text from looking authoritative |
| Decision | neutral_citation, forum, decision_date, subsequent_history, treatment_links, summary_permission | Avoid treating every decision as a timeless statutory rule |

Use null with a reason for unknown dates. A table of legislative changes may identify amendment history without alone resolving commencement or a mixed-subsection version. The date the court decided a case belongs in `decision_date`; an adapter can preserve an existing required field without pretending that the case is legislation commencing on that date. Clarify the existing `supersedes` convention before writing migration logic.

## Ingestion workflow

1. Register source and scope, then check rights and permitted access. Stop on access blocks. A licence to reproduce does not itself authorize a crawler.
2. Acquire through the permitted route using the required identifying User-Agent and at least 1.5 seconds between requests. Log retrieval time, redirects, status and policy check. Cache only where storage is authorized; exclude cache from distributable builds.
3. Preserve an immutable, authorized source version and content hash. For non-verbatim rights, keep only the allowed original summary/metadata and the external link.
4. Extract structure before chunking: Act → Part → Division → section → subsection; decisions → paragraphs; reports → page and heading; filed bylaws → clause plus amendment event. Preserve formula images and table relationships for review rather than discarding them as decoration.
5. Resolve cross-references, definitions, exceptions and referenced regulations. Do not treat a bare “Part 7” as a single invented item. Resolve to existing IDs or a documented group/anchor supported by the repository model.
6. Validate citation support, legal-version metadata, topic IDs, required fields and permissions. Quarantine conflicting or uncertain items. Human review is a separate state transition.
7. Build a reproducible manifest; retain earlier released versions; index only the authorized release set. Record the source/version IDs needed to reproduce each answer.

## Building bylaw reconciliation

Maintain a chronological amendment ledger. Each event should identify the filed instrument, vote/passage date where verified, registration date, affected clauses and operation: add, replace, repeal, renumber or consolidate. A recent PDF is not necessarily the entire current bylaw set. A manager-prepared consolidation may be useful but needs reconciliation against filed instruments.

Store property designations and agreements separately from bylaw text. For example, a parking rule does not prove ownership of a parking area. Keep corporation, section and shared-facility entities distinct. Attach a document-completeness assessment so the answer can say which source is missing.

## Answer workflow

Classify the question by jurisdiction, topic, actor, requested remedy and relevant event date. Identify whether the user needs general law, a building rule, a firm process, a disputed factual conclusion or a calculation. Ask only for missing information that changes the result; otherwise answer the grounded portion and state the specific gap.

Before retrieval, authorize the firm/building/section/document scope. Search only that scope plus permitted public-law material. Combine exact lexical lookup for citations/clauses with semantic search for questions, then rerank for authority, topic, version and passage support. These are proposed methods; no technology vendor or database is prescribed by this research.

Retrieve referenced definitions and exceptions alongside the main provision. Prefer primary law for legal wording, official guidance for explanation, approved decisions for interpretation, actual building documents for building facts, and firm material for firm procedure. This is a retrieval policy, not a mechanical statement that one source always defeats another in a legal dispute. Court/tribunal authority and subsequent history need legal review.

Build an internal evidence table: claim → supporting passage → applicable version → missing facts → conflict flags. Generate the answer from that table. The output should separate what is established, what the building documents say and what remains undetermined. Every citation must be accessible to the user receiving the answer; do not leak hidden document titles through citations.

## Calculations and deadlines

Use deterministic functions for voting denominators, schedules, allocation formulas and date arithmetic once the controlling rules have been verified. The language model should choose the correct rule with explicit assumptions, not invent the rule or silently perform high-stakes arithmetic. Inputs should include notice/service events, calendar context, category-specific exceptions and version. Return a traceable calculation, not an unsupported number.

No deadline engine or fine calculator was implemented in this research. A due date cannot be generated safely from a generic mention of “one week” without identifying the correct triggering event and applicable computation rules.

## Abstention and escalation

Use “no grounding found” when the supplied corpus cannot support the requested proposition. Give a precise reason: missing building clause; historical version unavailable; actual policy missing; source access blocked; inconsistent sources; unresolved forum; unclear authority; missing event dates; or private evidence not authorized. Where possible, still explain the general grounded framework.

Route requests for individual dispute strategy, legal validity guarantees, privilege determinations, urgent court relief and unresolved human-rights issues to an appropriate human review workflow. Do not turn a general explanation into an automatically sent enforcement action.

## Quality and evaluation gates

| Gate | Proposed release criterion |
|---|---|
| Structural integrity | Zero missing required fields, duplicate IDs, unresolved required citations or invalid topic IDs |
| Citation entailment | Every material legal proposition supported by its cited passage; exceptions and dates represented |
| Access isolation | Zero unauthorized cross-building, cross-firm or restricted-document exposure in adversarial tests |
| Temporal selection | No known historical/current version confusion in the release suite |
| Abstention | Unsupported building facts and unavailable authorities trigger the expected gap response |
| Rights | Every indexed item has an explicit permitted storage/retrieval basis and required attribution |
| Human authority | No model-generated reviewed/approved status; no automated council decision |
| Eval isolation | No test prompts, expected answers or hidden fixtures enter retrieval indexes |

The pack supplies 74 seed tests; none have run against an app. Fifty cover the core ten topics, with at least one no-grounding case per topic. The remainder cover versioning, access boundaries, reporting dates, jurisdiction and missing evidence. For the remaining approved topics, write at least five additional tests after source completion; do not count generic test scaffolding as completed legal evaluation.

## Maintenance design

Retain the operating plan’s quarterly legislative sync and monthly decision review. Add a review queue for announced changes, approaching deadlines, broken URLs, stale guidance and source conflicts. A scheduled crawl is not a legal-review approval. Define an accountable owner and change-impact graph linking source versions to guides, templates and tests. No recurring task, subscription or automation was created in this session.
