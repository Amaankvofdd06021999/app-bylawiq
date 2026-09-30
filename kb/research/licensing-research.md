# BylawIQ source licensing research

Researched 2026-09-30. Primary sources were fetched directly unless marked **[secondary]** or **[archived]**. This is research, not legal advice. Everything under "Open questions for counsel" needs a lawyer's sign-off before launch.

## TL;DR matrix

| Licence id | Source | Store verbatim? | Show excerpts to paying users? | Commercial use? | Bulk / automated access | Confidence |
|---|---|---|---|---|---|---|
| `bc-kings-printer` | BC Laws (SPA, SPR, CRT Act, etc.) | **Yes** | **Yes** | **Yes**, expressly | Official CiviX API, licensed under the KP Licence. No rate-limit terms published. | High |
| `court-decisions` | BCSC / BCCA (bccourts.ca) | **Not without permission** | **Not without permission** (commercial) | **Permission required** for "user-pay legal research tools or software" | Judgment DB (`/jdb-txt/`) is disallowed in robots.txt | High |
| `crt-decisions` | Civil Resolution Tribunal | **Unknown**: no reuse licence found | Unknown | Unknown: no licence found. BC Gov's default copyright statement says no reproduction without permission. | Decisions site returns 403 to non-browser clients. No API found. | Low to medium |
| `canlii` | CanLII | **No** (for our use case) | **No** reproduction from CanLII. Linking is fine. | **No.** The 2026-06-03 terms limit storage and use to legal research and the practice, study or teaching of law. | **Prohibited.** The API gives metadata only, by key on request. robots.txt says `User-agent: * Disallow: /`. | High |
| `ogl-bc` | Open Government Licence – BC | n/a | n/a | n/a | n/a | High that it **does not apply** to any of the above |

**Bottom line**
- The Strata Property Act, the Strata Property Regulation and other BC statutes and regulations can be stored verbatim, chunked, embedded, quoted and used commercially under the King's Printer Licence. We must show the mandatory attribution statement and must not present the text as official.
- BC Supreme Court and Court of Appeal judgments need **written permission** from the courts before we use them in a paid product.
- CanLII must **not** be used as an ingestion source.
- CRT decisions: we found no published reuse licence, so ask the CRT in writing before storing full text.

---

## 1. BC Laws: `bc-kings-printer`

**Covers:** Strata Property Act, SBC 1998, c 43 (page footer: "Copyright © King's Printer, Victoria, British Columbia, Canada", links to the Licence; current to September 22, 2026). Strata Property Regulation, B.C. Reg. 43/2000. Civil Resolution Tribunal Act, SBC 2012, c 25. Any other text on bclaws.gov.bc.ca marked "LICENSED BY: KING'S PRINTER".

**Licence:** King's Printer Licence – British Columbia, **version 1.1**. https://www.bclaws.gov.bc.ca/standards/Licence.html (fetched in full)

### Allowed
- Commercial and non-commercial use, worldwide, royalty-free, perpetual.
- Copying, publishing and distributing in whole or in part.
- Changing the format and including the text in "Your own product or application (including in combination with other information)".
- This covers storing verbatim, chunking, embedding and quoting to users.

Exact quotes:
> "1.1 The Information Provider grants You a worldwide, royalty-free, perpetual, non-exclusive licence to use the Information in accordance with, and subject to, the conditions below."

> "2.0 Unless otherwise specified, You may do any of the following for any lawful commercial or non-commercial purpose:
> 2.1 use, copy, publish and distribute the Information by any means, in whole or in part; and
> 2.2 modify the medium or format of the Information and include all or any portion of the Information in Your own product or application (including in combination with other information)."

### Required conditions
> "3.1 exercise due diligence in ensuring that any Information that You use, copy, publish, distribute or modify the medium or format of in accordance with this Licence is accurate and current;"

> "3.2 not, unless otherwise instructed by the Information Provider, remove or in any way alter any disclaimer, attribution statement or other notice that is provided by the Information Provider in, on or in association with the Information; and"

> "3.3 at least once in association with any Reproduction, whether in written or electronic format, prominently display the following statement ..."

> "These are important conditions of this licence and, if You fail to comply with any of them, the rights granted to You under this licence ... will end automatically without further notice being provided to You."

### Required attribution text (verbatim; must be displayed prominently at least once per Reproduction)
> "These materials contain information that has been derived from information originally made available by the Province of British Columbia at: http://www.bclaws.gov.bc.ca and this information is being used in accordance with the King's Printer Licence – British Columbia available at: https://www.bclaws.gov.bc.ca/standards/Licence.html. They have not, however, been produced in affiliation with, or with the endorsement of, the Province of British Columbia and THESE MATERIALS ARE NOT AN OFFICIAL VERSION."

### Not allowed or not covered
> "4.1 This licence does not: (a) grant You any rights except those specifically stated above; (b) cover any personal information ...; (c) include any Information or third party rights in the Information that the Information Provider does not own or is not authorized to license; or (d) include other intellectual property rights, including any trade-mark(s), official mark(s) or Provincial symbol(s) ..."

> "5.1 This Licence does not grant You any right to use the Information in any way that claims or suggests any official status or that the Information Provider endorses either You or Your use of the Information."

> "8.1(a) ... this licence does not cover any of the Information Provider's fillable forms or other documents that incorporate such prescribed content."

This matters for the Strata Property Act forms (Form A to Form N):
- The prescribed content of the forms is covered.
- The government's fillable versions of the forms are not.

The BC Government copyright page confirms that the King's Printer Licence governs legislation reuse:
> "For the reproduction of provincial legislation found on the BC Laws website, permission is subject to the terms of the King's Printer Licence – British Columbia."

Source: https://www2.gov.bc.ca/gov/content/home/copyright. **[archived]** Wayback snapshot of 2026-09-19; the live site hung up on our fetch.

### Bulk / API
- There is an official **CiviX Server API**: https://www.bclaws.gov.bc.ca/civix/template/complete/api/index.html
- It has Content, Document and Search endpoints and returns raw XML.
- Licence, per the API page: "BC Provincial content: King's Printer Licence". Local government bylaws fall under the separate "Local Government Bylaw Licence".
- The bclaws API announcement (https://www.bclaws.gov.bc.ca/bclawsapi.html) says the documents are:
  > "published under a permissible licence, which allows commercial and non-commercial access to, and use of, the legislative materials on the site (please check the licence as some restrictions apply)."
- **Unknown:** no rate limits, API key requirements or separate API terms of use are published on the API page. Crawl politely (low concurrency, identifying User-Agent) and subscribe to the API mailing list for change notices.

### Recommended BylawIQ practice
- **Store verbatim**, chunk, embed and quote. Ingest via the CiviX API, not HTML scraping.
- Show the exact attribution statement **prominently**. At minimum:
  - on every screen or export that shows legislative text or citations (a persistent source footer counts);
  - in any PDF or DOCX export or resident notice that quotes legislation.
- Label quoted legislation "unofficial copy – verify at BC Laws" and deep-link each section to its bclaws URL. This isn't strictly required, but it supports clause 3.1 (due diligence) and clause 5.1 (no official status).
- Store the "current to" date per document and re-sync on a schedule (clause 3.1 requires currency). Show the "current to" date next to quotes.
- Do not use the BC coat of arms or government logos.

**Confidence:** High. The full licence text was fetched from the primary source.

---

## 2. Civil Resolution Tribunal decisions: `crt-decisions`

### Where decisions are published
- **CRT decisions database:** https://decisions.civilresolutionbc.ca/crt/en/nav.do. This is a Lexum/Decisia site and also hosts several other BC tribunals.
  - It returned **HTTP 403** to both WebFetch and curl, so we could not read any terms on the live site.
  - An archived copy of the nav page shows no terms-of-use or copyright link.
- **CanLII** (`/bc/bccrt`) also publishes CRT decisions [secondary: CRT and search results]. See the CanLII section: CanLII is not a usable source for us.
- CRT help page (https://civilresolutionbc.ca/help/how-do-i-search-crt-decisions/):
  > "CRT final decisions are posted publicly on our Decisions page. You don't need a CRT Account to access the decisions database. You can search our decisions database by a participant's name, a dispute number, or keywords. Or you can browse decisions by claim type, like strata or vehicle accident claims."

### Statutory basis
Civil Resolution Tribunal Act, s. 85 (from BC Laws):
> "85(1) The tribunal must make the following information available to the public, including by making it available on the internet: ... (d) the final decisions of the tribunal under section 46 ..., except final decisions in respect of parties in default."

Section 86(3) allows the tribunal to "remove or obscure personal information or replace personal information with anonymous identifiers" for publication.

### Copyright and reuse
- **No reuse or copyright licence for CRT decisions was found** on civilresolutionbc.ca. The homepage links only to the Information Access and Privacy page and the decisions site.
- The CRT is a BC government tribunal. The BC Government default copyright statement (https://www2.gov.bc.ca/gov/content/home/copyright, [archived] 2026-09-19) says:
  > "This material is owned by the Government of British Columbia and protected by copyright law. It may not be reproduced or redistributed without the prior written permission of the Province of British Columbia."
- **Unknown** whether that statement governs CRT decisions. The CRT runs its own site and publishes no statement of its own.
- For comparison, another BC tribunal (the BC Human Rights Tribunal, https://www.bchrt.bc.ca/help/copyright/ [secondary via search]) allows reproduction with attribution. It also states:
  > "Reproduction of multiple copies of any material for the purposes of commercial redistribution is prohibited except with written permission."
  The CRT may take a similar position. This is **not confirmed**.

### Privacy expectations
The CRT *Access to Information and Privacy Policy* (June 2026) is at https://civilresolutionbc.ca/wp-content/uploads/CRT-Access-to-Information-and-Privacy-Policy-June-2026.pdf. The PDF was fetched and its text extracted.
> "The CRT usually includes parties' names in published decisions. However, in disputes where there is a need to protect a party's identity (such as if they are a minor (a child under 19) or an adult with impaired mental capacity), a tribunal member may anonymize one or more parties' names."

> "Party names may only be anonymized in the version of the decision posted online. The official version of the decision and copies of it provided to the parties will include party names."

From https://civilresolutionbc.ca/resources/information-access-and-privacy/:
> "If you're concerned that information in a final decision or order would be harmful to your privacy or security, you can ask the CRT to remove or anonymize that information from the published decision."

What this means for us:
- The CRT can change published decisions after the fact through anonymization and removal.
- A stored copy can therefore go stale and keep personal information that the CRT has since removed.
- Intimate Images Protection Act decisions carry publication bans. They are irrelevant to strata, but ingestion should exclude them.

### Bulk / automated
- No API was found.
- civilresolutionbc.ca/robots.txt allows most paths, but the decisions subdomain blocks non-browser clients (403).
- **Do not scrape** the decisions site without permission.

### Recommended BylawIQ practice (conservative until the CRT answers)
- **Ask the CRT in writing** for permission to store and quote strata decisions in a paid product. Ask about bulk access too: Lexum may offer a feed.
- Until permission is granted:
  - store **metadata and our own summaries only**: citation (e.g. "2024 BCCRT 123"), date, claim type, member, outcome, and the legal propositions in our own words;
  - link to the CRT decisions page;
  - keep any short quotations brief and attributed, relying on fair dealing (a counsel question);
  - **avoid storing or displaying party names**. Refer to cases by neutral citation. This is also good privacy hygiene for a multi-tenant product.
- Attribution to use either way: "Source: Civil Resolution Tribunal, [citation], decisions.civilresolutionbc.ca". Do not suggest endorsement.
- If permission is granted, re-sync periodically so that post-publication anonymization and removals propagate. Hard-delete removed decisions and their chunks and embeddings.

**Confidence:** Low to medium. The absence of terms is confirmed for the pages we could reach; the decisions site itself was unreachable (403).

---

## 3. BC Supreme Court and Court of Appeal decisions: `court-decisions`

Source: BC Superior Courts "Privacy Statement" page, which contains the copyright terms. https://www.bccourts.ca/Privacy%20Statement.html (fetched with curl; WebFetch failed on the TLS certificate.)

> "The Court of Appeal for British Columbia and the Supreme Court of British Columbia are the copyright owners of the information unless otherwise stated."

> "Reasons for judgment — No permission is required to use court decisions for a scholarly, journalistic, or government purpose, provided users exercise due diligence to ensure the accuracy and currency of any court decisions used, identify the Court by name as the source of any information that uses published court decisions, and do not suggest that court decisions have been used in affiliation with or with the endorsement of the Courts."

> "**Permission is required to use published court decisions for a primarily commercial activity such as commercial redistribution of court decisions, developing and/or providing user-pay legal research tools or software, and/or developing and/or providing user-pay judgment analytics.**"

> "To seek permission to use published court decisions for a commercial activity, please complete this application and send it as an attachment to CAJ@BCCourts.ca (for reasons for judgment published by the Court of Appeal); and/or SC.Publishing@BCCourts.ca (for reasons for judgment published by the Supreme Court)."

Application form: https://www.bccourts.ca/documents/Application_for_Permission_to_Use_Published_Court_Decisions.pdf (fetched). Key text:
> "Permission is required to use published court decisions for a primarily commercial (profit-seeking) activity such as commercial redistribution of court decisions; developing and/or providing user pay legal research tools or software; and/or developing and/or providing user pay judgment analytics."

> "In reviewing the application, the Courts will consider ... whether granting permission ... will: serve the public interest ...; help to maintain public confidence in the integrity and independence of the court system ...; and prevent use of court decisions for improper purposes, such as to profile or identify individuals for commercial purposes or for direct marketing purposes."

The form also asks:
- how we will store and maintain decisions (Q10);
- whether we will distribute "excerpts, summaries or other information derived from the court decisions" (Q11);
- which users will have access (Q8).

It also covers Provincial Court decisions: JDBC@provincialcourt.bc.ca.

On search engine indexing, the Court of Appeal "About Judgments" page (https://www.bccourts.ca/court_of_appeal/about_judgments.aspx) says:
> "The policy of the Court is to block search engines such as Google from indexing the judgment database."

bccourts.ca/robots.txt includes `Disallow:/jdb-txt/`, which is the judgment database path.

### Recommended BylawIQ practice
- BylawIQ is a user-pay legal research tool, so **do not ingest BCSC or BCCA judgments until permission is granted**. File the application for the Supreme Court and the Court of Appeal, and optionally the Provincial Court.
- Until then:
  - hand-curate citation-only references, e.g. "The Owners, Strata Plan LMS 3259 v. Sze Hang Holding Inc., 2016 BCSC 32", with a link to bccourts.ca or CanLII;
  - write summaries of the legal principle in our own words, reviewed by a lawyer;
  - store no full text and no bulk excerpts.
- Attribution once permission is granted: name the court. Terms may be set in the permission letter.

**Confidence:** High. The terms are on the primary source.

---

## 4. CanLII: `canlii`

The live terms page (https://www.canlii.org/en/info/terms.html) returns **403** to automated clients. We read the current version, **"Last updated: 2026-06-03"**, from the Wayback Machine **[archived]**: https://web.archive.org/web/20260609081241/https://www.canlii.org/info/terms.html

### Preamble (new in 2026)
> "The published documents are obtained directly from originating bodies such as courts, tribunals, official publishers and other providers, under arrangements that may limit CanLII's ability to redistribute them to third parties. Organizations and individuals seeking automated or large-scale retrieval of these documents should do so from the original sources or through other authorized channels."

### Reproduction
> "4.2 ... legal materials published on the CanLII Websites, such as legislation, decisions and commentary, including editorial enhancements ... can be copied, printed and used by Users free of charge and without any other authorization from CanLII, provided that CanLII is identified as the source of the document."

> "4.3 ... courts and government bodies may claim intellectual property rights relating to their documents. ... Users remain responsible for checking whether the intended use of the documents is authorized;"

### Prohibited uses (these defeat our use case)
> "5.1 ... the following uses of the CanLII Websites are prohibited:
> - Incorporating published documents into another website but masking their origin or source through framing, re-use of search processes, or any other means ...;
> - External indexing of published documents by Web robots when such use is not authorized by the instructions in a robots exclusion file ...;
> - **Systematic downloading of published documents, including via programmatic means such as, but not limited to, crawlers, plug-ins, extensions, connectors, bots, or, for greater certainty, the hiring of human resources used to manually download documents**; and
> - **Storing, reproducing, redistributing, or otherwise using published documents for purposes other than the User's legal research and the practice, study or teaching of law.**"

> "5.2 CanLII reserves the right to block, at its discretion and without prior notice, any User from accessing the CanLII Websites ..."

Governing law is Quebec; the forum is the District of Montreal (s. 9.1).

For comparison, the earlier version (2023-10-18, [archived] 2024-12-22) prohibited "Bulk or systematic downloading of documents". It did not have the "storing ... for purposes other than ... legal research" clause.

### robots.txt (https://www.canlii.org/robots.txt, fetched live)
- The file ends with `User-agent: *` / `Disallow: /`, which blocks every unnamed bot, including ours and ClaudeBot.
- It names GPTBot and disallows `/bc/bcsc`, `/bc/bcca` and `/bc/bccrt`.

### API
- GitHub docs: https://github.com/canlii/API_documentation/blob/master/EN.md
  > "CanLII maintains an API that allows authorized developers to programmatically access metadata about the CanLII collection."
  > "To apply for an API key, please send a message with your contact information to the feedback form."
- The API returns metadata only (titles, citations, dates, citator relationships), not full text.
- **Unknown:** no separate public API terms of use were found. Terms are presumably set when the key is issued. A secondary source (vaquill.ai blog) says keys are issued for research and educational use; this is unverified.

### Enforcement precedent
- *CanLII v. Caseway AI* (BCSC, filed November 2024) alleged "bulk and systematic download and scraping" of about 3.5 million records, in breach of the terms of use and copyright in CanLII's editorial enhancements.
- Settled around March 2026; terms undisclosed.
- Sources [secondary]:
  - https://www.cbc.ca/news/canada/british-columbia/canlii-lawsuit-caseway-ai-1.7374964
  - https://www.canadianlawyermag.com/news/general/canlii-settles-copyright-infringement-suit-with-ai-legal-assistant-caseway-ai/393881

### Generative AI page
Source: https://www.canlii.org/info/generative-ai.html, [archived] 2026-03-13. It describes only CanLII's own AI use:
> "The AI models used are not permitted to be trained on the processed materials."

It does not grant third parties any AI rights.

### Recommended BylawIQ practice
- **Never scrape, bulk-download or store CanLII content.**
- Linking to CanLII URLs for a citation is fine: the terms don't prohibit hyperlinks. Use links, not framing.
- Optionally apply for a metadata API key to enrich citations (citator, "cited by"). Confirm the key terms allow commercial use first.
- Source full text from the originating body (BC Laws; CRT and courts with permission), as CanLII's own preamble says to.

**Confidence:** High on the terms (verbatim text from a June 2026 archive). Medium on the API terms, which are unpublished.

---

## 5. Open Government Licence: `ogl-bc` (and federal OGL-Canada)

The OGL-BC, version 2.0, is at https://www2.gov.bc.ca/gov/content/data/policy-standards/open-data/open-government-licence-bc ([archived] 2025-04-09). Its scope is narrow:
> "Note: as per B.C. Government Copyright, the following licence only applies to records in the B.C. Data Catalogue that specify it."

- **It does not cover:** BC statutes and regulations (King's Printer Licence), court decisions (the courts' own policy) or CRT decisions (no licence found).
- **Attribution, if it ever applies:** "Contains information licensed under the Open Government Licence – British Columbia."
- The BC Laws API has a Data Catalogue entry (https://catalogue.data.gov.bc.ca/dataset/bc-laws-api), but the API page itself states that the King's Printer Licence governs the content.
- The federal Open Government Licence – Canada covers federal data only and is irrelevant to BC law.

**Confidence:** High that OGL-BC is not the operative licence for any of our sources.

---

## 6. AI training and grounding

- **King's Printer Licence:** it says nothing specific about AI. Clause 2.2 allows including the text "in Your own product or application (including in combination with other information)" for commercial purposes. On a plain reading that covers RAG grounding, embedding and quoting. Model training isn't prohibited either, though BylawIQ does not train models.
  - Conditions still apply to any AI output that reproduces the text: attribution (3.3), no official status (5.1) and accuracy and currency (3.1).
- **BC courts:** the permission form asks how decisions will be stored and whether "excerpts, summaries or other information derived from the court decisions" will be distributed. AI-generated summaries and derived answers are therefore within scope of the permission requirement. Disclose RAG use in the application.
- **CanLII:** clause 5.1 prohibits storing or using documents outside legal research and legal practice or education, and prohibits programmatic downloading. CanLII has sued an AI company over this. There is no AI carve-out.
- **CRT:** no AI-specific policy was found.
- **Copyright Act (Canada):** Crown copyright (s. 12) and fair dealing (s. 29) may support short quotations for research. How they apply to a commercial RAG product is untested. See the counsel questions.

---

## 7. Implementation checklist for BylawIQ

1. Add a `license_id` column to the source and document tables, with values `bc-kings-printer`, `crt-decisions`, `court-decisions` and `canlii`. Gate ingestion on `license_id` plus a `permission_status` value (`granted`, `pending` or `not_required`).
2. Render the exact King's Printer attribution statement prominently wherever legislation is quoted, including exports and resident notices. Show "current to <date>" with each quote.
3. Deep-link every citation to its official source (a bclaws section anchor, a CRT decision URL, a bccourts.ca judgment URL).
4. Hold ingestion of full-text court and CRT decisions until written permission arrives. Until then use neutral citations, links and lawyer-reviewed summaries.
5. Keep no CanLII crawler or scraper anywhere in the codebase. The only allowed use is the metadata API with an issued key and confirmed terms.
6. Build a re-sync and takedown path so anonymizations, removals and amendments propagate to chunks and embeddings. Per AGENTS.md, re-embedding needs a plan.
7. Use polite access to the BC Laws API: identifying User-Agent, low concurrency, scheduled delta syncs.

---

## Open questions for counsel

1. **King's Printer attribution placement:** does one persistent footer or "Sources" panel satisfy the "at least once in association with any Reproduction ... prominently display" requirement for each AI answer and each exported notice? Or must the statement appear inside every export and document sent to a resident?
2. **Crown copyright in CRT decisions:** who owns copyright in CRT decisions (the CRT, the Province, or the King's Printer)? Does the BC Gov default "no reproduction without permission" statement apply? Whom should we ask for a commercial licence: the CRT, or the Intellectual Property Program at QPIPPCopyright@gov.bc.ca?
3. **Fair dealing for RAG:** can we store full text internally, for retrieval only, and display short attributed excerpts under Copyright Act s. 29 (research) without permission? This matters especially for court decisions, where the courts' policy requires permission for "user-pay legal research tools".
4. **Scope of the courts' permission:** does "use" in the BC Courts policy cover citation-only references and our own summaries of legal principles, with no text stored? This is our proposed interim practice.
5. **Personal information:** do party names in CRT and court decisions stored in a commercial database trigger PIPA (BC) obligations? Should we strip names at ingestion?
6. **CanLII links and metadata:** are hyperlinks to CanLII pages and use of the metadata API (if a key is granted) acceptable under clause 5.1 for a commercial product? Clause 5.1 limits storing and using documents; metadata is arguably not a "published document".
7. **Strata Property Act forms:** the licence covers prescribed form content but excludes the government's "fillable forms". Can we generate our own Form B, Form F and similar from the prescribed content?
8. **Currency duty (KP clause 3.1):** what re-sync frequency and "current to" labelling satisfies "exercise due diligence in ensuring ... accurate and current"?
9. **Liability framing:** confirm that our disclaimer plus the "NOT AN OFFICIAL VERSION" statement is enough. The licence's no-endorsement clause and the courts' no-affiliation condition interact with our product's legal-information positioning.

## Fetch log

| Source | Status |
|---|---|
| bclaws.gov.bc.ca/standards/Licence.html | Fetched, full text |
| bclaws CiviX API page | Fetched |
| bclawsapi.html | Fetched |
| Strata Property Act page footer | Fetched |
| CRT Act s. 85–86 | Fetched |
| www2.gov.bc.ca copyright and OGL-BC | Live fetch failed (socket hang-up); used Wayback captures of 2026-09-19 and 2025-04-09 |
| bccourts.ca Privacy Statement, permission application PDF, BCCA About Judgments, robots.txt | Fetched with curl (TLS certificate issue in WebFetch) |
| civilresolutionbc.ca privacy page, help page and privacy policy PDF | Fetched |
| decisions.civilresolutionbc.ca | **403**; no terms visible in the archived copy |
| canlii.org/en/info/terms.html | **403** live; used Wayback captures of 2026-06-09 (terms dated 2026-06-03) and 2024-12-22 |
| canlii.org/robots.txt | Fetched live |
| CanLII API docs (GitHub) | Fetched |
| CanLII generative AI page | Wayback capture of 2026-03-13 |
| Caseway litigation, BCHRT copyright policy | Secondary (search results only) |
