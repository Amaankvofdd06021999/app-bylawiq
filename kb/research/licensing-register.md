# Licensing register

Every kb item's `licence` field must be an id from the table below. `tools/validate.ts` reads the ids from the first column (the value in backticks), so keep one licence per row and keep the id in backticks.

A separate researcher is verifying these terms now. Until a row says **Verified**, treat its permissions as unknown and use the conservative path: structured summary in our own words plus a link to the source, no verbatim text.

<!-- TODO(legal): replace every "To verify" with the verified terms, the date checked, and a link to the licence text. -->

| Licence id | Source | Verbatim text allowed? | Attribution required | Commercial use | Terms and link | Status | Checked on | Notes |
|---|---|---|---|---|---|---|---|---|
| `bc-kings-printer` | BC Laws (King's Printer for British Columbia): Acts and regulations | To verify | To verify | To verify | To verify | To verify | | Consolidated statutes on bclaws.gov.bc.ca. Confirm whether reproduction of consolidations is permitted and what disclaimer is required. |
| `crt-decisions` | Civil Resolution Tribunal published decisions | To verify | To verify | To verify | To verify | To verify | | Decisions published by the CRT. Confirm reuse terms, and whether party names must be handled specially. |
| `court-decisions` | BC Supreme Court and BC Court of Appeal judgments (courts.gov.bc.ca) | To verify | To verify | To verify | To verify | To verify | | Confirm the courts' reproduction policy and any publication bans handling. |
| `canlii` | CanLII | No (link only) | n/a | n/a | To verify | To verify | | Link only. Do not scrape or copy CanLII content. Cite the neutral citation and link to CanLII or the primary source. |
| `bylawiq-original` | Written by BylawIQ staff or contractors | Yes | No | Yes | Owned by BylawIQ | Verified | | Topic guides, firm and building starter kits, structured summaries, evals. Confirm contractor IP assignment is in place. |
