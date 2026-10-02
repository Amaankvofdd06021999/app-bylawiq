# Collection scripts

The scripts that built the indexes in the folder above. They are kept so a later run can be
compared with this one, and so the method can be checked rather than taken on trust.

| Script | What it does |
|---|---|
| `bcc_all.py` | Pages the BC Supreme Court and Court of Appeal judgment search for each phrase, first result to last. |
| `bcc_condo_parse.py` | Re-parses cached `condominium` pages; kept because it is the version with the pre-1999 fix written out plainly. |
| `crt_other.py` | Pages the CRT's non-strata collections for decisions mentioning strata. |
| `crt_narrow.py` | Re-searches those collections for discriminating phrases, to score confidence. |
| `crt_rest_full.py` | The four CRT collections left over (accident benefits, accident claims, accident responsibility, intimate images). |
| `merge_indexes.py` | Merges every run into the two indexes and prints the coverage report. |

## Rules every one of them follows

- Sequential, two seconds between requests, identifying User-Agent with a contact address.
- Every page cached under `kb/.cache/`, so a re-run fetches nothing it already has.
- A hard stop on any non-200. A 403 is a stop, not something to work around.
- **Search result pages only.** No judgment or decision document is ever fetched: `/jdb-txt/` is
  disallowed by robots.txt on bccourts.ca, and no reuse licence has been established for either
  body of decisions. The indexes therefore carry no reasons.
- No style of cause is recorded for court judgments: the names of private individuals are not kept.

## The two mistakes these scripts have already made

Both were silent — the run looked healthy while rows went missing — and both were caught only by
reconciling the parsed count against the site's own total. Do that every time.

1. **Keying a row on its neutral citation.** BC neutral citations begin in 1999; the court database
   goes back to 1990. 1,123 judgments have none, and a citation-keyed parser dropped every one of
   them while the page counter kept climbing.
2. **Case-sensitive patterns against a site that is not consistent.** bccourts.ca serves both
   `/jdb-txt/` and `/Jdb-txt/`, which cost 27 rows. The CRT serves `/crt/crtd/` for strata and
   `/crt/abc/` for accident benefits, and writes the date span as `publicationDate`, which cost all
   41 rows of the last four collections until the counts were compared.
