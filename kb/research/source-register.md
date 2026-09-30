# Source register

Every source the kb draws on, and where it lands. Add a row before pulling from a new source. `Licence id` must match a row in `licensing-register.md`.

Status values: `planned` (not started), `in progress`, `loaded` (items exist in kb/), `blocked` (licensing or access question open; see `open-questions.md`).

| Source | URL | Layer | Licence id | Status | Output location | Notes |
|---|---|---|---|---|---|---|
| Strata Property Act | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/98043_01 | law | `bc-kings-printer` | planned | `law/bc/acts/strata-property-act/` | Confirm chapter and consolidation date in `source.json`. |
| Strata Property Regulation | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/43_2000 | law | `bc-kings-printer` | planned | `law/bc/regulations/strata-property-regulation/` | |
| Schedule of Standard Bylaws (Strata Property Act) | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/98043_01 | law, building | `bc-kings-printer` | planned | `law/bc/acts/strata-property-act/` (as `schedule` items) and `building-starter/standard-bylaws/` | Confirm where the schedule sits in the consolidation. |
| Human Rights Code | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_96210_01 | law | `bc-kings-printer` | planned | `law/bc/acts/human-rights-code/` | Accommodation and discrimination sections only. |
| Residential Tenancy Act | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/02078_01 | law | `bc-kings-printer` | planned | `law/bc/acts/residential-tenancy-act/` | Strata overlap only. |
| Civil Resolution Tribunal Act | https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/12025_01 | law | `bc-kings-printer` | planned | `law/bc/acts/civil-resolution-tribunal-act/` | Strata jurisdiction and process sections. |
| CRT strata property decisions | https://decisions.civilresolutionbc.ca/crt/en/nav.do | law | `crt-decisions` | planned | `law/bc/decisions/crt/` | 50 to 100 decisions spread across the taxonomy. URL to verify. |
| BC Supreme Court and Court of Appeal judgments | https://www.bccourts.ca/search_judgments.aspx | law | `court-decisions` | planned | `law/bc/decisions/courts/` | Key strata cases. URL to verify. |
| CanLII | https://www.canlii.org/ | law | `canlii` | planned | links in `source_url` only | Link only, no scraping. |
| BylawIQ staff writing | n/a | topic, firm, building | `bylawiq-original` | in progress | `topics/`, `firm-starter/`, `building-starter/`, `evals/` | |
