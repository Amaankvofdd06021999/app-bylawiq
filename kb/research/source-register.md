# Source register

Every source the kb draws on, and where it lands. Add a row before pulling from a new source. `Licence id` must match a row in `licensing-register.md`.

Status values: `planned` (not started), `in progress`, `loaded` (items exist in kb/), `blocked` (licensing or access question open; see `open-questions.md`).

| Source | URL | Layer | Licence id | Status | Output location | Notes |
|---|---|---|---|---|---|---|
| Strata Property Act | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/98043_01 | law | `bc-kings-printer` | planned | `law/bc/acts/strata-property-act/` | Confirm chapter and consolidation date in `source.json`. |
| Strata Property Regulation | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/43_2000 | law | `bc-kings-printer` | planned | `law/bc/regulations/strata-property-regulation/` | |
| Schedule of Standard Bylaws (Strata Property Act) | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/98043_01 | law, building | `bc-kings-printer` | planned | `law/bc/acts/strata-property-act/` (as `schedule` items) and `building-starter/standard-bylaws/` | Confirm where the schedule sits in the consolidation. |
| Human Rights Code | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_96210_01 | law | `bc-kings-printer` | planned | `law/bc/acts/human-rights-code/` | Accommodation and discrimination sections only. URL checked 2026-09-30 (consolidation current to 2026-09-22). Verbatim allowed with attribution. |
| Residential Tenancy Act | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/02078_01 | law | `bc-kings-printer` | planned | `law/bc/acts/residential-tenancy-act/` | Strata overlap only. URL checked 2026-09-30. Verbatim allowed with attribution. |
| Civil Resolution Tribunal Act | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/12025_01 | law | `bc-kings-printer` | planned | `law/bc/acts/civil-resolution-tribunal-act/` | Strata jurisdiction and process sections. URL checked 2026-09-30. Verbatim allowed with attribution. |
| CRT strata property decisions | https://decisions.civilresolutionbc.ca/crt/en/nav.do | law | `crt-decisions` | blocked | `law/bc/decisions/crt/` | 50 to 100 decisions spread across the taxonomy. URL confirmed by the CRT help page; the site returns 403 to automated clients, so do not scrape it. Full text blocked until the CRT confirms reuse (open question 19). Allowed now: citation, link and our own reviewed summary, no party names. |
| BC Supreme Court and Court of Appeal judgments | https://www.bccourts.ca/search_judgments.aspx | law | `court-decisions` | blocked | `law/bc/decisions/courts/` | Key strata cases. Full text and excerpts blocked until the courts grant written permission (open question 18). Allowed now: citation, link and our own lawyer-reviewed summary. The judgment database is disallowed in robots.txt. Search URL still to verify. |
| CanLII | https://www.canlii.org/ | law | `canlii` | planned | links in `source_url` only | Link only. Never scrape, download or store CanLII content (terms of 2026-06-03, cl. 5.1; robots.txt disallows all unnamed bots). |
| BylawIQ staff writing | n/a | topic, firm, building | `bylawiq-original` | in progress | `topics/`, `firm-starter/`, `building-starter/`, `evals/` | |
