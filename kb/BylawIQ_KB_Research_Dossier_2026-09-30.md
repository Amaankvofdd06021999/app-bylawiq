# BylawIQ: knowledge-base research and build dossier

Research date: **September 30, 2026**. Status: **draft**. Reviewed by: null. Reviewed at: null.

**BylawIQ needs a versioned legal corpus, verified building documents, a permission-cleared decision corpus and tightly scoped firm workflows.** Gathering Acts alone will not support reliable building-specific answers. This research maps the content, source acquisition, interpretation risks, retrieval design and review work needed to build those layers.

The handoff contains **40 source-register entries, 36 official pages with relevant passages or indexes read, 42 evidence notes, 52 proposed topics, 19 legislation-scope groups, 25 building-document categories, 74 evaluation seeds and 25 implementation tasks**. The remaining four source entries record unresolved or blocked sources. The pack includes machine-readable JSON and readable source, topic, document and drafting companions.

This is a research foundation, not a completed production KB. The supplied operating plan reports 303 SPA sections, 29 Standard Bylaw items and 91 regulation items already imported. The actual repository, taxonomy, README, importer and validator were not present, so those counts and items could not be checked. No production KB items were created, no production validation/build was run, and no existing corpus was modified. Verified decision candidates and summaries both remain at zero for the reasons below.

## What the research changes about the build

| Finding | Why BylawIQ needs it | Source |
|---|---|---|
| Current law and historical events must be separated | Rental restrictions changed in 2022, but older disputes and documents may still surface. A current-law answer cannot silently answer a historical question. | [Provincial STR/rental guidance](https://www2.gov.bc.ca/gov/content/housing-tenancy/strata-housing/operating-a-strata/bylaws-and-rules/short-term-rental-bylaws), F11 |
| Hearing and enforcement procedures are different linked processes | A hearing request has its own timing. Do not turn that into a universal response deadline for every allegation. | [Council hearing guidance](https://www2.gov.bc.ca/gov/content/housing-tenancy/strata-housing/operating-a-strata/meetings-and-voting/council-meetings), F04; [SPA](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/98043_00_multi), F01 |
| Official guidance can conflict | The records page still refers to family-member tenant access; newer tenant guidance and current statutory text require a different rights analysis. Add a conflict flag, rather than trusting every official page equally. | [Records guidance](https://www2.gov.bc.ca/gov/content/housing-tenancy/strata-housing/operating-a-strata/information-and-record-keeping); [tenant guidance](https://www2.gov.bc.ca/gov/content/housing-tenancy/strata-housing/renting-buying-selling/renting-in-stratas/tenants-in-stratas), F14–F16 |
| Reporting deadlines depend on a building’s cohort | The first relevant depreciation transition deadline has passed; the first electrical-planning deadline is approaching. Lot count, location, island exceptions and creation/report dates matter. | [Depreciation requirements](https://www2.gov.bc.ca/gov/content/housing-tenancy/strata-housing/operating-a-strata/repairs-and-maintenance/depreciation-reports/depreciation-report-requirements), F21–F22; [electrical planning](https://www2.gov.bc.ca/gov/content/housing-tenancy/strata-housing/operating-a-strata/the-environment/electrical-planning-report), F23–F24 |
| Strata human-rights coverage includes services | Importing only tenancy-related human-rights material would leave an important gap for owners and shared services. | [BCHRT services framework](https://www.bchrt.bc.ca/law-library/leading-cases/services-public/), F18 |
| Forum selection is part of the knowledge base | Strata, tenancy, human-rights, privacy and professional-regulation disputes cannot all be routed to one tribunal. | [CRT strata scope](https://civilresolutionbc.ca/solution-explorer/strata/), F32; [RTB guideline 27](https://www2.gov.bc.ca/assets/gov/housing-and-tenancy/residential-tenancies/policy-guidelines/gl27.pdf), F35–F36; [BCFSA](https://www.bcfsa.ca/industry-resources/real-estate-professional-resources/knowledge-base/strata-management-resources/working-with-strata-management-company), F37 |
| A building answer needs the actual documents | The registry and operational records are separate acquisition channels. Public legal research cannot establish the building’s current bylaw or parking agreement. | [LTSA acquisition guidance](https://ltsa.ca/property-owners/how-can-i/find-strata-property-information/), F38–F39 |
| Legislative reproduction rights and automated access are separate | The legislation licence allows commercial reproduction with conditions, but the BC Laws robots response blocked general automated access during this research. Resolve the acquisition route before implementing a crawler. | [King’s Printer Licence](https://www.bclaws.gov.bc.ca/standards/Licence.html); observed robots response; [Licensing_and_Access.md](Licensing_and_Access.md) |

These findings are explained in the [42 linked evidence notes](Evidence_and_Sources.md). They are deliberately concise; primary provisions, effective versions and actual KB citation IDs must still be resolved before promotion. Research date is not a guarantee of legislative currency: the SPA consolidation read was current to **September 22, 2026**, leaving an intervening-change check before a September 30 current-law release.

## Coverage of the entire intended KB

The proposed [52-topic coverage map](Topic_Coverage.md) preserves the operating plan’s ten busiest topics and adds governance, finance, reporting, property, transactions, management, disputes and specialist boundaries. Its IDs are proposals, not assertions about the unavailable taxonomy.

| Coverage group | Content needed | Research state |
|---|---|---|
| Enforcement and occupation | Pets, noise, rentals, STR, fines, s.135, hearings, smoking, age, moving, accommodation | Core official guidance and process distinctions gathered; actual statute/item links and decisions pending |
| Records and privacy | SPA records access, tenant assignment, personal-information requests, cameras/fobs, retention and disclosure | Core records guidance gathered; source conflict logged; current OIPC guide and primary privacy provisions unresolved |
| Governance | Bylaws/rules, amendment history, defaults, meetings, proxies, council authority, sections/types | Source routes and key distinctions gathered; detailed primary provisions and specialist coverage still needed |
| Finance | Budgets, entitlements, CRF, levies, arrears, interest, liens and collection | Official finance guidance gathered; exact collection/limitation rules require further authority |
| Buildings and infrastructure | Boundaries, repair, leaks, insurance, alterations, emergencies, depreciation, electrical planning, EV charging | Guidance and required input documents gathered; technical facts and building-specific allocation cannot be inferred |
| Transfers and management | Form B, Form F, parking/storage, tenant documents, management services, new-development turnover | Form B, parking, tenant and management guidance gathered; Form F and turnover rules require deeper statutory work |
| Forums and remedies | CRT, courts, RTB interface, BCHRT, privacy oversight, limitation/service rules | Current procedural source versions identified; decision interpretation, court remedies and limitation rules incomplete |
| Specialist and local | Bare-land, leasehold, mixed-use, developer/warranty, municipal rules, building/fire safety | Bounded follow-up scope proposed; no claim of complete substantive coverage |

The missing areas are represented as explicit backlog and open-question records, rather than empty documents presented as completed knowledge. For specialist instruments and municipal coverage, the product owner and counsel should approve scope under A7 before import.

## Law acquisition and versioning

Complete A1–A3 against the real baseline first: cross-references, effective dates and image formulas. The operating plan identifies six formula locations—SPA 99, 195, 227, 247, 273 and 278—but their images were not transcribed or independently checked here. Formula completion must remain open.

Then import the Civil Resolution Tribunal Act, Human Rights Code and Residential Tenancy Act with their general definitions, applicability, procedural and remedy dependencies. A selected-section importer needs an explicit inclusion/exclusion manifest. A section mentioned by another provision is a dependency to investigate, not an automatic permission to import unrelated material.

The [19-group legislation scope](legislation-scope.json) proposes PIPA, limitations, interpretation, title/filing, the additional strata regulations, STR legislation, service-dog protections, management regulation and specialist overlays for approval. The provincial index confirms that the main Strata Property Regulation is not the only strata regulation. [Source](https://www2.gov.bc.ca/gov/content/housing-tenancy/strata-housing/legislation-and-changes/strata-legislation), F42.

Store distinct dates for retrieval, displayed publication, consolidation cutoff, legal effect and decision issuance. Keep the evidence for commencement and transitional application. Do not set a section’s current-version date from its original enactment date or infer commencement solely from an amendment’s assent date. Preserve historic versions for event-date questions.

The source register and rights register must remain separate concerns: source authority, access permission, text reuse, embeddings and redistribution are different checks. This pack contains short original research and links; it does not authorize copying whole explanatory websites.

## Building knowledge and onboarding

The [25-category acquisition checklist](Building_Documents.md) covers registered plans, all filed amendments, rules, minutes/resolutions, budgets, allocations, reports, insurance, Forms B/F/K, parking arrangements, alterations, maintenance, enforcement, accommodation, management and local documents.

Treat completeness as data. Record what is missing, why it matters and who can supply it. Reconcile a manager’s bylaw consolidation with the full filed amendment chain. Capture repeal/replacement events, not merely the most recent PDF timestamp. Keep section records separate from corporation records and distinguish a property right from permission to use space.

Some documents contain private or privileged material. Obtain them through an authorized onboarding process and assign document-level access before indexing. A resident role should not automatically reveal council files, another owner’s account, a health record or another building’s documents. The checklist’s access labels are proposed software controls, not legal determinations about disclosure entitlement.

No private building records were gathered, and no registry purchases were made. The checklist is usable immediately for planning an authorized acquisition request; exact statutory duty citations still need mapping.

## Decision corpus: essential work still open

The operating plan’s targets remain **150 CRT candidates and 40 BCSC/BCCA candidates**, with topic coverage and subsequent-history checks. This session produced **zero verified candidates and zero summaries**. The CRT decision portal returned 403; relevant official court candidates were not successfully verified; full court terms timed out. No party names or unsupported holdings were added to fill the gap.

C3 has an additional permission gate: summaries require the recorded permission response or explicit human approval specified in the plan. That more specific rule controls over the plan’s general summary-only description. No such approval evidence was supplied.

The [candidate-queue specification](decision-candidate-queues.json) includes metadata fields, coverage targets and selection rules. Once access is resolved, prioritize explanatory value and outcome diversity: procedure failures, evidentiary failures, successful enforcement, exceptions and distinguishable facts. Track appeal, judicial review and later treatment. Candidate metadata is discovery material and must never be used as a substitute for a verified holding.

## Topic, building and firm writing

[Content_Briefs.md](Content_Briefs.md) provides specifications for the core guides, every Standard Bylaw note, the nine bylaw patterns, five templates, three SOPs and three staff guides. These are research drafting briefs. They have not been promoted to production content or approved for use in an individual dispute.

Each final topic guide needs a passage-level citation for every factual sentence, including exceptions and dates. Building notes should cite the single law item rather than duplicate its text. Pattern notes should leave `tested_in` empty until a permitted, verified decision supports the specific proposition.

All firm material must retain **needs counsel review**. The tenant-notice workflow deserves particular review: the plan’s “via landlord” wording should not cause a template to omit notice or a response opportunity for a legally required recipient. See F01. Keep allegations, responses, hearings, decisions and collection as separate recorded stages.

## Retrieval and answer behavior

The [data-model design](Retrieval_and_Data_Model.md) specifies versioned provenance, access filters, ingestion, amendment reconciliation, citation resolution, abstention and maintenance. Its central recommendation is to filter by authority, version and authorized building scope **before** generating an answer.

For each proposed answer, assemble an evidence table linking the claim to its exact passage and version. Retrieve definitions and exceptions with the main provision. Separate the law from the building clause and from disputed facts. If one of those is missing, identify that gap; do not substitute a generic template or a similar case as if it established the missing fact.

Use deterministic calculations after choosing a verified rule for vote thresholds, allocations and deadlines. Store the inputs and calculation trace. Do not generate deadline dates without the proper triggering event, service facts and applicable computation rules.

The design also protects against source conflicts and embedded instructions in uploaded documents. Retrieved text is evidence to interpret, not authority to change the assistant’s access rules or disclose other documents. Research files, candidate queues, tests and answer keys must stay outside public retrieval.

## Evaluation and release

The pack includes **74 unexecuted evaluation seeds**: five for each core topic, including a no-grounding question, plus 24 cross-cutting checks. They cover misleading defaults, missing bylaw text, stale legislation, unsupported fine amounts, notice recipients, jurisdiction, reporting cohorts, privacy and cross-building leakage.

These are research seeds, not certified expected answers. Required production citation IDs are null until actual items are verified. Expected evidence IDs point to the research notes, and the fixture records are explicitly non-retrievable. The remaining approved topics still need at least five substantive tests each once their sources are complete.

Release gates should include structural validation, citation support, temporal correctness, source rights, access isolation and appropriate no-grounding behavior. Zero unresolved citation IDs is necessary but insufficient: the cited passage must actually support the claim. The real `pnpm --dir kb validate` and build gates remain mandatory; this pack’s integrity check does not replace them.

## Recommended build sequence

| Order | Concrete next deliverable | Dependency |
|---|---|---|
| 1 | Repository baseline and reconciled control files | Provide actual README, taxonomy, registers, importer and validator |
| 2 | Permitted legislative acquisition plus A1–A3 audit | Resolve BC Laws access route and version evidence |
| 3 | Core related Acts and approved A7 scope | Verify primary text, dependencies and exact production IDs |
| 4 | Building document onboarding and reconciled bylaws | Authorized source documents and access boundaries |
| 5 | Ten core guides and evaluated answer behavior | Verified sources, real building inputs and citation resolution |
| 6 | Verified decision candidate queues and permitted summaries | Source access, recorded permission/approval and full-source reading |
| 7 | Remaining topic/building material and counsel-reviewed firm kit | Coverage and review gates |
| 8 | Reproducible release and monitored upkeep | Actual validation/build, manifests and accountable review owners |

The operating plan’s phase order remains the production work queue. This research gathered non-blocked source material across phases without claiming those phases complete. [implementation-backlog.json](implementation-backlog.json) gives task-level dependencies and acceptance criteria.

## What needs human input

The [16 open questions](Open_Questions.md) have suggested owner roles and affected tasks. The immediate needs are the actual repository; a permitted BC Laws acquisition route; CRT/court access and the original permission replies; the current privacy guide; approval of additional-law scope; and authorized building documents.

Other flagged issues are the eight-day SPA consolidation gap, stale official guidance, formula verification, unverified initial counts, supersession semantics and specialist/local scope. These are specific completion dependencies. No emails, permission requests, subscriptions, purchases or recurring automations were initiated.

Start with the repository and access questions, then use the source register, evidence notes and backlog together. That makes each production item traceable to an observed source and a concrete review gate.
