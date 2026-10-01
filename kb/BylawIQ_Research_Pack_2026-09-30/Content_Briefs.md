# Content drafting briefs

Status: draft. Reviewed by: null. Reviewed at: null. All firm material: **needs counsel review**.

These are drafting specifications, not approved notices or imported KB items. F-number references identify research evidence in this pack. Replace them with actual, verified KB item citations before production. The repository README and approved taxonomy control the final format.

## Topic-guide contract

Each guide should answer one recognizable user question family. Use the operating plan’s headings: Summary; What the law says; What the standard bylaws say; What decisions have held; Common mistakes; Related topics. Add a short intake box identifying the building facts needed for an answer.

Write one legal proposition per sentence when practical. Each factual sentence must have its own supporting inline KB citation. A citation must support the proposition, its exception and the date being discussed. A general section citation is insufficient when the conclusion depends on a subsection or a building amendment. Mark decision coverage “Decisions: to be added” until C3 is authorized and a summary has been verified.

Separate three statements in every building-specific explanation: the legal boundary, the applicable building provision, and the unresolved facts. Do not turn industry practice into law. Do not decide credibility or liability from a complaint alone. If the building bylaw is missing, give the grounded general rule and identify the missing document; do not fill the gap with the Standard Bylaws as an assumed fact.

| Core guide | Evidence seeds | Additional evidence needed before publication |
|---|---|---|
| Pets | F07–F08 | Actual Standard Bylaw item, current statutory grandfathering text, building restriction and accommodation sources |
| Noise | F01, F05 | Standard nuisance provision, relevant building wording, permitted decision summaries addressing evidence and reasonableness |
| Rentals | F11, F13–F14 | Current and historical rental provisions and bylaw dates |
| Short-term rentals | F02, F11–F12 | Current provincial STR legislation, selected municipality, tenancy classification and actual bylaw |
| Fines | F01–F03 | Exact SPR ceilings/frequency, actual fine schedule, party liable versus party from whom collection is permitted |
| s.135 enforcement | F01 | Delivery rules, actual allegations/recipients, decision chronology, approved case interpretation |
| Hearings | F04 | Actual request/receipt/hearing dates, decision request and applicable service rules |
| Water leaks | F19–F20 | Plan boundaries, repair bylaws, policy, technical facts, chargeback authority and permitted case interpretation |
| Strata fees/arrears | F28–F29 | Entitlements, levy/fee classifications, lien and limitation sources, ledger facts |
| Privacy/records | F14–F16 | Current PIPA/OIPC source, requester capacity, document category, disclosure exceptions and privilege |

For the remaining topics, use proposed-topic-map.json as the research intake and coverage checklist. It is not a substitute for reading the underlying statute. In particular, leasehold, Form F, court remedies, limitation periods, local permits and safety need further substantive research.

## Standard Bylaw notes

Create notes only after enumerating the real imported Schedule items. The brief’s count of 29 has not been checked. A repealed provision needs an accurate historical treatment, not a fabricated current note.

Each note needs: exact source item ID; provision heading; what activity it addresses; whether the default applies; filed amendment/replacement check; interaction with mandatory legislation; common drafting variations expressed as examples; required building documents; related topics; and unresolved interpretation. Do not copy the default text into another retrieval item. Cite the law item and preserve a single authoritative text version.

## Nine bylaw-pattern research briefs

These are possible drafting categories to research, not recommended or validated bylaw wording. Every pattern’s `tested_in` list remains empty. Approval of a pattern does not validate a specific building’s bylaw.

| Pattern | Variants to research | Checks before drafting | Evidence seeds |
|---|---|---|---|
| Rentals | Remove obsolete clauses; distinguish tenancy administration from occupancy restrictions | Event date, statutory change and non-rental provisions that still require analysis | F11, F13–F14 |
| Short-term rentals | Prohibition; duration definition; administrative notice; applicable fine provision | Provincial/local context, activity definition, bylaw authority and lawful evidence | F02, F11–F12 |
| Pets | Number/species; conduct; leash/control; areas; exemptions | Grandfathering, actual default/replacement, human-rights accommodation | F07–F08 |
| Noise | General nuisance; flooring/renovation controls; quiet-hour clauses | Actual clause, reasonableness, evidence and consistent process; no invented universal decibel rule | F01, F05 |
| Smoking/cannabis | Scope by area; smoke migration; implementation and accommodation | Lot versus shared-space authority, medical need and other applicable law | F09, F17 |
| Parking/storage | Use allocation; visitor use; permitted activities; EV arrangements | Ownership/designation, agreement term, authority, user fee versus fine | F27 |
| Alterations | Approval process; drawings; indemnity/maintenance agreements; restoration | Property category, statutory limits, permits, prospective-owner disclosure | F19, F25 |
| Moving | Scheduling; elevator protection; deposits; reasonable user-fee mechanism | Instrument and ratification, cost/fee authority, refund terms, enforcement process | F05 |
| Fines | Category-specific schedule; recurrence; decision and ledger process | Actual authorization, ceilings, procedural prerequisites and collection distinction | F01–F03 |

## Five firm template specifications

Use `{{double_braces}}` placeholders. Include source references beside required process steps during drafting; use real KB IDs only after resolution. All five templates must be stored in the firm layer and carry `notes: "needs counsel review"`. They are draft-generation inputs; nothing in this pack authorizes sending a notice.

1. **Notice of alleged bylaw/rule contravention.** Inputs: `{{recipient_role}}`, `{{alleged_conduct}}`, `{{event_dates}}`, `{{actual_clause_text_and_version}}`, `{{supporting_particulars}}`, `{{response_method}}`, `{{reasonable_response_arrangement}}`, `{{hearing_request_method}}`, `{{required_other_recipients}}`, `{{delivery_record}}`. Label the matter as an allegation. Explain the response opportunity; do not pre-write a finding or silently impose a universal 14-day period. Evidence: F01.
2. **Hearing-request acknowledgment.** Inputs: `{{request_received_at}}`, `{{request_reason}}`, `{{decision_requested}}`, `{{hearing_date}}`, `{{attendance_details}}`, `{{accessibility_arrangements}}`, `{{materials_process}}`. Keep request receipt, hearing occurrence and requested decision delivery as separate events. Verify timing against F04 and the actual primary item.
3. **Decision following hearing/response.** Inputs: `{{decision_maker}}`, `{{materials_considered}}`, `{{response_summary}}`, `{{finding_and_reasons}}`, `{{applicable_clause}}`, `{{legal_basis}}`, `{{outcome}}`, `{{decision_date}}`, `{{delivery}}`. State only supported findings; reflect any accommodation analysis. The template must support an outcome that no breach or no sanction is found. Evidence: F01, F04, F17.
4. **Fine notice.** Inputs: `{{prior_process_reference}}`, `{{contravention_finding}}`, `{{applicable_fine_bylaw}}`, `{{fine_amount}}`, `{{contravention_period}}`, `{{repeat_fine_basis}}`, `{{liable_person}}`, `{{payment_information}}`, `{{decision_delivery}}`. Check the actual fine authority; keep chargebacks, interest and fines separate. Do not generate a fine notice if the antecedent process is missing. Evidence: F01–F03.
5. **Tenant contravention notice with owner/landlord copies.** Inputs include all allegation fields plus `{{tenant_recipient}}`, `{{owner_recipient}}`, `{{landlord_recipient}}`, `{{role_overlap}}`, `{{delivery_for_each_recipient}}`. The operating plan’s phrase “via landlord” must not become an assumption that owner-only notice substitutes for the tenant’s response opportunity. Resolve the recipient requirements from the primary law. Evidence: F01, F13–F14.

Keep actual names, addresses, medical details and account data out of the shared template corpus. They belong in a separately authorized case workspace when a user generates a document.

## Three SOP specifications

**Complaint handling — needs counsel review.** Intake and classify the issue; verify the operative clause and entity; preserve authorized evidence; identify actual decision authority and conflicts; identify accommodation or urgent safety issues; determine required recipients; issue a reviewable allegation notice; track response/hearing stages; record the reasoned council decision and delivery; then create a separately classified ledger entry if authorized. Distinguish statutory requirements from an optional firm service target. Never label an automated allegation analysis a council decision. Evidence: F01–F05, F17, F37.

**Records requests — needs counsel review.** Record receipt and scope; verify the requester’s capacity and authority; distinguish the applicable statutory route; identify record categories and the corresponding deadline; check privilege, exemptions and authorized disclosures using current sources; calculate permitted fees separately from inspection; retain a decision and delivery log. A software role is not proof of legal entitlement. Resolve the stale family-tenant guidance conflict before drafting a definitive checklist. Evidence: F14–F16; exact privacy exceptions remain a blocker.

**Accommodation requests — needs counsel review.** Provide a confidential intake route; identify the service and functional need; seek only information needed to assess the request; document reasonable alternatives and the affected person’s input; escalate unresolved legal questions; record evidence supporting any hardship position; communicate a reasoned decision; define a review point if circumstances change. Do not make certification, majority preference or a blanket bylaw the sole decision criterion. Evidence: F08, F17–F18.

## Three staff guidance pieces

The s.135 guide should explain stage gates and failure modes; the records guide should explain request-route and recipient differences; the accommodation guide should explain evidence, confidentiality and individualized assessment. Each should link to its corresponding template/SOP, verified statute items, source-version dates and related evaluation cases. No staff-only firm policy should be represented to residents as legislation.

## Decision research expansion

Retain the brief’s targets of 150 CRT and 40 court candidates; actual verified counts in this pack are zero. Build a topic/outcome matrix before selecting summaries. Include cases where process failed, where evidence was insufficient, where the strata succeeded, and where a superficially similar dispute turned on a different fact. Do not select only the newest or most frequently quoted decisions.

For each candidate, verify neutral citation, tribunal/court, date, official URL, relevance and subsequent treatment. Keep permission/access state separately. A search snippet or a secondary case digest is a discovery lead, not proof of the holding. If later scope includes BCHRT/OIPC or appellate authorities beyond BCSC/BCCA, approve the added corpus and its reuse conditions first.

## Completion rule

Promote these briefs only when source rights, primary provisions, actual item IDs and topic IDs are established. Run the real repository validation and build. Leave all material draft with reviewer fields null until a person performs the required review.
