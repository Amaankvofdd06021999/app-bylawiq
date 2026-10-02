# BC Supreme Court and Court of Appeal strata judgment candidates

Task C2. Judgments worth reading. **It does not say what any of them decided**, and the "why it
matters" column the task asked for is not here. The reason is access, not effort:

- `robots.txt` on bccourts.ca disallows `/jdb-txt/`, which is where every judgment lives. So the
  judgments cannot be read by an automated client, and the research plan's rule 3 says obey
  robots.txt.
- The search results pages are allowed, and they were used. They carry only a style of cause, a
  neutral citation, a date and a court. There is no snippet. Abstracts exist for a handful of Court
  of Appeal judgments and are mostly about other areas of law.
- Writing a reason from memory instead would break rule 1. Nothing here is written from memory.

**Party names are deliberately absent.** The search results give a style of cause; the research
plan's rule 6 forbids recording the names of private individuals, so only the neutral citation is
kept. The neutral citation identifies the judgment on its own.

**Nothing may be summarised from these yet.** The courts require written permission to use published
decisions in a user-pay legal research tool, and it has not been asked for: open question 18. Until
then the interim practice is citation and link only.

## What is here

`courts-index.jsonl` holds **4,790 judgments, 1990 to 2026**: 3,946 BC Supreme Court and 844 Court
of Appeal, one JSON object per line with the neutral citation where one exists, the court, the date,
the official URL, and which search found it.

| Decade | Judgments |
|---|---|
| 1990s | 467 |
| 2000s | 1,048 |
| 2010s | 1,600 |
| 2020s | 1,675 |

Built by searching "strata" — the broadest term, and a superset of the narrower strata phrases —
and paging the entire result set, then the same for "Condominium Act", which covers the pre-2000
regime and does not always contain the word strata. The topical phrase searches from the earlier
pass are merged in, and 127 judgments carry topic hints from them.

**463 judgments have no neutral citation** and are keyed by their file id instead. BC neutral
citations began around 1999, so these are the oldest rows in the set, back to 24 January 1990. A
citation-keyed parser drops them silently; that happened on the first pass and was caught only by
reconciling the parsed count against the site's own total.

**The breadth has a cost.** "strata" matches the word in any sense, and in the older years that
includes geology: the earliest hit, from January 1990, is a mining case. Filter `found_by` to
`phrase:Strata Property Act` (739) or `phrase:Condominium Act` (234) for judgments that are
certainly about strata or its predecessor regime.

## How to finish C2

A person with a browser can open these links and read the judgments; robots.txt governs automated
clients, not people. The most economical order is the section-specific groups below, which are
small and certainly about strata. Alternatively, resolve open question 18 first, since the
permission application has to be made before any of this can become a summary anyway.

## How the list was built

`POST` to `https://www.bccourts.ca/search_judgments.aspx`, which robots.txt allows, sequential,
2 seconds apart, with an identifying User-Agent; raw HTML cached in `kb/.cache/bccourts/`
(git-ignored). **No judgment was requested.** Paging is an ASP.NET postback, so each request carries
the viewstate and session cookie from the previous response, and is pinned to HTTP/1.1 because
HTTP/2 fails on a body that size against this host. Neither is evasion: the User-Agent still
identifies this bot and the path is one robots.txt allows.

The search is exact-phrase: a word-bag query such as "pet bylaw strata" returns nothing, while
"pet bylaw" returns results. Results come back newest first, not by relevance, so these are not
"leading" cases in any sense — that judgment has to be made by someone who reads them.

Six phrases returned nothing at all and are recorded so nobody repeats them: "section 34.1 of the
Strata Property Act", "section 121 …", "section 123 …", "section 130 …", "section 141 …" and
"section 158 …". Judgments generally write "s. 141" rather than spelling the section out, so the
absence means nothing about whether such judgments exist.

## Summary

127 distinct judgments: 106 Supreme Court, 21 Court of Appeal, 2002-06-20 to 2026-07-22. The task's target was 40.

| Phrase searched | Topic | Judgments | Is it a strata case? |
|---|---|---|---|
| "repair and maintain common property" | `repair-maintenance` | 50 | Very likely |
| "short term accommodation" | `short-term-rentals` | 22 | **Unverified** |
| "section 164 of the Strata Property Act" | `crt-process` | 21 | Certain |
| "rental restriction bylaw" | `rentals` | 13 | Certain |
| "section 72 of the Strata Property Act" | `repair-maintenance` | 12 | Certain |
| "section 165 of the Strata Property Act" | `crt-process` | 7 | Certain |
| "pet bylaw" | `pets` | 4 | Certain |
| "section 135 of the Strata Property Act" | `bylaw-enforcement-s135` | 3 | Certain |
| "section 36 of the Strata Property Act" | `privacy-records` | 3 | Certain |
| "section 35 of the Strata Property Act" | `privacy-records` | 2 | Certain |
| "section 71 of the Strata Property Act" | `common-property-use` | 2 | Certain |
| "section 132 of the Strata Property Act" | `fines` | 1 | Certain |
| "section 149 of the Strata Property Act" | `insurance-deductibles` | 1 | Certain |

## "pet bylaw"

Topic `pets`. Pet bylaws.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2006 BCSC 967 | BCSC | 2006-06-21 | [link](https://www.bccourts.ca/jdb-txt/sc/06/09/2006bcsc0967.htm) |
| 2008 BCSC 1755 | BCSC | 2008-12-18 | [link](https://www.bccourts.ca/jdb-txt/SC/08/17/2008BCSC1755.htm) |
| 2010 BCSC 1301 | BCSC | 2010-09-16 | [link](https://www.bccourts.ca/jdb-txt/SC/10/13/2010BCSC1301.htm) |
| 2018 BCSC 1855 | BCSC | 2018-10-25 | [link](https://www.bccourts.ca/jdb-txt/sc/18/18/2018BCSC1855.htm) |

## "rental restriction bylaw"

Topic `rentals`. Rental restriction bylaws, most of them decided before section 141 took its current form.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2002 BCSC 924 | BCSC | 2002-06-20 | [link](https://www.bccourts.ca/jdb-txt/sc/02/09/2002bcsc0924.htm) |
| 2009 BCSC 1733 | BCSC | 2009-12-17 | [link](https://www.bccourts.ca/jdb-txt/SC/09/17/2009BCSC1733.htm) |
| 2014 BCSC 1507 | BCSC | 2014-08-11 | [link](https://www.bccourts.ca/jdb-txt/SC/14/15/2014BCSC1507.htm) |
| 2014 BCSC 2375 | BCSC | 2014-12-15 | [link](https://www.bccourts.ca/jdb-txt/SC/14/23/2014BCSC2375.htm) |
| 2016 BCCA 345 | BCCA | 2016-08-05 | [link](https://www.bccourts.ca/jdb-txt/ca/16/03/2016BCCA0345.htm) |
| 2017 BCSC 1039 | BCSC | 2017-06-22 | [link](https://www.bccourts.ca/jdb-txt/sc/17/10/2017BCSC1039cor1.htm) |
| 2018 BCSC 2064 | BCSC | 2018-11-23 | [link](https://www.bccourts.ca/jdb-txt/sc/18/20/2018BCSC2064cor1.htm) |
| 2019 BCCA 64 | BCCA | 2019-02-21 | [link](https://www.bccourts.ca/jdb-txt/ca/19/00/2019BCCA0064.htm) |
| 2020 BCSC 818 | BCSC | 2020-06-02 | [link](https://www.bccourts.ca/jdb-txt/sc/20/08/2020BCSC0818cor1.htm) |
| 2020 BCSC 2051 | BCSC | 2020-12-22 | [link](https://www.bccourts.ca/jdb-txt/sc/20/20/2020BCSC2051.htm) |
| 2021 BCSC 1752 | BCSC | 2021-09-02 | [link](https://www.bccourts.ca/jdb-txt/sc/21/17/2021BCSC1752.htm) |
| 2023 BCSC 2080 | BCSC | 2023-11-27 | [link](https://www.bccourts.ca/jdb-txt/sc/23/20/2023BCSC2080.htm) |
| 2024 BCSC 112 | BCSC | 2024-01-26 | [link](https://www.bccourts.ca/jdb-txt/sc/24/01/2024BCSC0112cor1.htm) |

## "section 132 of the Strata Property Act"

Topic `fines`. Maximum fines.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2002 BCSC 936 | BCSC | 2002-06-21 | [link](https://www.bccourts.ca/jdb-txt/sc/02/09/2002bcsc0936.htm) |

## "section 135 of the Strata Property Act"

Topic `bylaw-enforcement-s135`. Complaint, right to answer and notice of decision.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2012 BCSC 1542 | BCSC | 2012-10-22 | [link](https://www.bccourts.ca/jdb-txt/SC/12/15/2012BCSC1542.htm) |
| 2016 BCSC 148 | BCSC | 2016-01-15 | [link](https://www.bccourts.ca/jdb-txt/sc/16/01/2016BCSC0148.htm) |
| 2023 BCSC 1398 | BCSC | 2023-08-11 | [link](https://www.bccourts.ca/jdb-txt/sc/23/13/2023BCSC1398.htm) |

## "section 149 of the Strata Property Act"

Topic `insurance-deductibles`. Property insurance the strata corporation must carry.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2021 BCSC 2058 | BCSC | 2021-10-21 | [link](https://www.bccourts.ca/jdb-txt/sc/21/20/2021BCSC2058.htm) |

## "section 164 of the Strata Property Act"

Topic `crt-process`. Preventing or remedying significantly unfair acts.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2003 BCSC 120 | BCSC | 2003-01-23 | [link](https://www.bccourts.ca/jdb-txt/sc/03/01/2003bcsc0120.htm) |
| 2003 BCSC 1364 | BCSC | 2003-07-25 | [link](https://www.bccourts.ca/jdb-txt/sc/03/13/2003bcsc1364.htm) |
| 2003 BCSC 1316 | BCSC | 2003-08-29 | [link](https://www.bccourts.ca/jdb-txt/sc/03/13/2003bcsc1316.htm) |
| 2006 BCCA 243 | BCCA | 2006-05-17 | [link](https://www.bccourts.ca/jdb-txt/ca/06/02/2006bcca0243.htm) |
| 2007 BCSC 206 | BCSC | 2007-02-14 | [link](https://www.bccourts.ca/jdb-txt/sc/07/02/2007bcsc0206.htm) |
| 2009 BCSC 1733 | BCSC | 2009-12-17 | [link](https://www.bccourts.ca/jdb-txt/SC/09/17/2009BCSC1733.htm) |
| 2010 BCSC 776 | BCSC | 2010-06-02 | [link](https://www.bccourts.ca/jdb-txt/SC/10/07/2010BCSC0776.htm) |
| 2010 BCSC 1725 | BCSC | 2010-12-03 | [link](https://www.bccourts.ca/jdb-txt/SC/10/17/2010BCSC1725cor1.htm) |
| 2011 BCSC 119 | BCSC | 2011-02-01 | [link](https://www.bccourts.ca/jdb-txt/SC/11/01/2011BCSC0119.htm) |
| 2012 BCCA 44 | BCCA | 2012-01-30 | [link](https://www.bccourts.ca/jdb-txt/CA/12/00/2012BCCA0044cor1.htm) |
| 2012 BCSC 1294 | BCSC | 2012-09-04 | [link](https://www.bccourts.ca/jdb-txt/SC/12/12/2012BCSC1294.htm) |
| 2012 BCSC 1577 | BCSC | 2012-10-26 | [link](https://www.bccourts.ca/jdb-txt/SC/12/15/2012BCSC1577.htm) |
| 2014 BCSC 2241 | BCSC | 2014-12-01 | [link](https://www.bccourts.ca/jdb-txt/SC/14/22/2014BCSC2241.htm) |
| 2016 BCSC 148 | BCSC | 2016-01-15 | [link](https://www.bccourts.ca/jdb-txt/sc/16/01/2016BCSC0148.htm) |
| 2018 BCSC 1969 | BCSC | 2018-11-08 | [link](https://www.bccourts.ca/jdb-txt/sc/18/19/2018BCSC1969.htm) |
| 2018 BCSC 2064 | BCSC | 2018-11-23 | [link](https://www.bccourts.ca/jdb-txt/sc/18/20/2018BCSC2064cor1.htm) |
| 2020 BCSC 1583 | BCSC | 2020-10-27 | [link](https://www.bccourts.ca/jdb-txt/sc/20/15/2020BCSC1583.htm) |
| 2020 BCCA 342 | BCCA | 2020-12-01 | [link](https://www.bccourts.ca/jdb-txt/ca/20/03/2020BCCA0342.htm) |
| 2021 BCSC 486 | BCSC | 2021-03-18 | [link](https://www.bccourts.ca/jdb-txt/sc/21/04/2021BCSC0486cor1.htm) |
| 2022 BCSC 743 | BCSC | 2022-05-06 | [link](https://www.bccourts.ca/jdb-txt/sc/22/07/2022BCSC0743.htm) |
| 2022 BCSC 1349 | BCSC | 2022-08-09 | [link](https://www.bccourts.ca/jdb-txt/sc/22/13/2022BCSC1349.htm) |

## "section 165 of the Strata Property Act"

Topic `crt-process`. Other orders a court may make.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2006 BCSC 1316 | BCSC | 2006-08-29 | [link](https://www.bccourts.ca/jdb-txt/sc/06/13/2006bcsc1316err1.htm) |
| 2007 BCSC 206 | BCSC | 2007-02-14 | [link](https://www.bccourts.ca/jdb-txt/sc/07/02/2007bcsc0206.htm) |
| 2008 BCSC 1606 | BCSC | 2008-11-24 | [link](https://www.bccourts.ca/jdb-txt/SC/08/16/2008BCSC1606.htm) |
| 2010 BCCA 324 | BCCA | 2010-06-18 | [link](https://www.bccourts.ca/jdb-txt/CA/10/03/2010BCCA0324cor1.htm) |
| 2013 BCSC 14 | BCSC | 2013-01-08 | [link](https://www.bccourts.ca/jdb-txt/SC/13/00/2013BCSC0014.htm) |
| 2014 BCCA 270 | BCCA | 2014-06-25 | [link](https://www.bccourts.ca/jdb-txt/CA/14/02/2014BCCA0270.htm) |
| 2022 BCCA 257 | BCCA | 2022-07-25 | [link](https://www.bccourts.ca/jdb-txt/ca/22/02/2022BCCA0257.htm) |

## "section 35 of the Strata Property Act"

Topic `privacy-records`. Records the strata corporation must prepare and retain.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2005 BCSC 1760 | BCSC | 2005-12-19 | [link](https://www.bccourts.ca/jdb-txt/sc/05/17/2005bcsc1760.htm) |
| 2020 BCSC 1917 | BCSC | 2020-12-04 | [link](https://www.bccourts.ca/jdb-txt/sc/20/19/2020BCSC1917.htm) |

## "section 36 of the Strata Property Act"

Topic `privacy-records`. Owner access to records.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2011 BCCA 512 | BCCA | 2011-12-15 | [link](https://www.bccourts.ca/jdb-txt/CA/11/05/2011BCCA0512.htm) |
| 2015 BCSC 750 | BCSC | 2015-05-07 | [link](https://www.bccourts.ca/jdb-txt/SC/15/07/2015BCSC0750.htm) |
| 2022 BCCA 189 | BCCA | 2022-05-27 | [link](https://www.bccourts.ca/jdb-txt/ca/22/01/2022BCCA0189.htm) |

## "section 71 of the Strata Property Act"

Topic `common-property-use`. Significant change in the use or appearance of common property.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2024 BCSC 2683 | BCSC | 2024-04-19 | [link](https://www.bccourts.ca/jdb-txt/sc/24/26/2024BCSC2683cor1.htm) |
| 2025 BCSC 1382 | BCSC | 2025-07-18 | [link](https://www.bccourts.ca/jdb-txt/sc/25/13/2025BCSC1382.htm) |

## "section 72 of the Strata Property Act"

Topic `repair-maintenance`. Who must repair and maintain, and what a bylaw may shift.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2003 BCSC 1364 | BCSC | 2003-07-25 | [link](https://www.bccourts.ca/jdb-txt/sc/03/13/2003bcsc1364.htm) |
| 2005 BCSC 1760 | BCSC | 2005-12-19 | [link](https://www.bccourts.ca/jdb-txt/sc/05/17/2005bcsc1760.htm) |
| 2006 BCSC 1316 | BCSC | 2006-08-29 | [link](https://www.bccourts.ca/jdb-txt/sc/06/13/2006bcsc1316err1.htm) |
| 2010 BCSC 776 | BCSC | 2010-06-02 | [link](https://www.bccourts.ca/jdb-txt/SC/10/07/2010BCSC0776.htm) |
| 2011 BCSC 119 | BCSC | 2011-02-01 | [link](https://www.bccourts.ca/jdb-txt/SC/11/01/2011BCSC0119.htm) |
| 2011 BCCA 231 | BCCA | 2011-05-05 | [link](https://www.bccourts.ca/jdb-txt/CA/11/02/2011BCCA0231.htm) |
| 2011 BCSC 1611 | BCSC | 2011-11-25 | [link](https://www.bccourts.ca/jdb-txt/SC/11/16/2011BCSC1611.htm) |
| 2012 BCSC 74 | BCSC | 2012-01-20 | [link](https://www.bccourts.ca/jdb-txt/SC/12/00/2012BCSC0074.htm) |
| 2019 BCSC 876 | BCSC | 2019-06-03 | [link](https://www.bccourts.ca/jdb-txt/sc/19/08/2019BCSC0876.htm) |
| 2022 BCSC 1095 | BCSC | 2022-06-29 | [link](https://www.bccourts.ca/jdb-txt/sc/22/10/2022BCSC1095.htm) |
| 2022 BCCA 337 | BCCA | 2022-10-05 | [link](https://www.bccourts.ca/jdb-txt/ca/22/03/2022BCCA0337cor1.htm) |
| 2025 BCSC 1382 | BCSC | 2025-07-18 | [link](https://www.bccourts.ca/jdb-txt/sc/25/13/2025BCSC1382.htm) |

## "repair and maintain common property"

Topic `repair-maintenance`. The Act's own words, so almost certainly strata, but the phrase could appear in another context.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2013 BCSC 2071 | BCSC | 2013-11-15 | [link](https://www.bccourts.ca/jdb-txt/SC/13/20/2013BCSC2071.htm) |
| 2013 BCSC 2293 | BCSC | 2013-12-12 | [link](https://www.bccourts.ca/jdb-txt/SC/13/22/2013BCSC2293cor1.htm) |
| 2014 BCSC 1426 | BCSC | 2014-05-02 | [link](https://www.bccourts.ca/jdb-txt/SC/14/14/2014BCSC1426.htm) |
| 2014 BCSC 2241 | BCSC | 2014-12-01 | [link](https://www.bccourts.ca/jdb-txt/SC/14/22/2014BCSC2241.htm) |
| 2015 BCSC 13 | BCSC | 2015-01-07 | [link](https://www.bccourts.ca/jdb-txt/SC/15/00/2015BCSC0013.htm) |
| 2015 BCSC 452 | BCSC | 2015-03-19 | [link](https://www.bccourts.ca/jdb-txt/SC/15/04/2015BCSC0452.htm) |
| 2015 BCSC 1816 | BCSC | 2015-08-14 | [link](https://www.bccourts.ca/jdb-txt/SC/15/18/2015BCSC1816.htm) |
| 2015 BCSC 1832 | BCSC | 2015-10-08 | [link](https://www.bccourts.ca/jdb-txt/SC/15/18/2015BCSC1832.htm) |
| 2015 BCSC 2043 | BCSC | 2015-11-06 | [link](https://www.bccourts.ca/jdb-txt/sc/15/20/2015BCSC2043.htm) |
| 2016 BCSC 401 | BCSC | 2016-03-08 | [link](https://www.bccourts.ca/jdb-txt/sc/16/04/2016BCSC0401.htm) |
| 2016 BCCA 118 | BCCA | 2016-03-15 | [link](https://www.bccourts.ca/jdb-txt/ca/16/01/2016BCCA0118cor1.htm) |
| 2016 BCSC 1206 | BCSC | 2016-06-30 | [link](https://www.bccourts.ca/jdb-txt/sc/16/12/2016BCSC1206.htm) |
| 2016 BCSC 1775 | BCSC | 2016-09-28 | [link](https://www.bccourts.ca/jdb-txt/sc/16/17/2016BCSC1775.htm) |
| 2016 BCSC 2363 | BCSC | 2016-12-16 | [link](https://www.bccourts.ca/jdb-txt/sc/16/23/2016BCSC2363.htm) |
| 2017 BCSC 14 | BCSC | 2017-01-04 | [link](https://www.bccourts.ca/jdb-txt/sc/17/00/2017BCSC0014.htm) |
| 2017 BCCA 92 | BCCA | 2017-02-27 | [link](https://www.bccourts.ca/jdb-txt/ca/17/00/2017BCCA0092.htm) |
| 2017 BCSC 2230 | BCSC | 2017-09-12 | [link](https://www.bccourts.ca/jdb-txt/sc/17/22/2017BCSC2230.htm) |
| 2018 BCSC 223 | BCSC | 2018-02-16 | [link](https://www.bccourts.ca/jdb-txt/sc/18/02/2018BCSC0223.htm) |
| 2018 BCSC 1342 | BCSC | 2018-08-10 | [link](https://www.bccourts.ca/jdb-txt/sc/18/13/2018BCSC1342cor1.htm) |
| 2018 BCSC 1502 | BCSC | 2018-09-04 | [link](https://www.bccourts.ca/jdb-txt/sc/18/15/2018BCSC1502.htm) |
| 2018 BCSC 1690 | BCSC | 2018-10-02 | [link](https://www.bccourts.ca/jdb-txt/sc/18/16/2018BCSC1690cor1.htm) |
| 2019 BCSC 286 | BCSC | 2019-03-06 | [link](https://www.bccourts.ca/jdb-txt/sc/19/02/2019BCSC0286cor1.htm) |
| 2019 BCSC 2356 | BCSC | 2019-09-12 | [link](https://www.bccourts.ca/jdb-txt/sc/19/23/2019BCSC2356.htm) |
| 2019 BCSC 1785 | BCSC | 2019-10-18 | [link](https://www.bccourts.ca/jdb-txt/sc/19/17/2019BCSC1785.htm) |
| 2020 BCCA 285 | BCCA | 2020-10-23 | [link](https://www.bccourts.ca/jdb-txt/ca/20/02/2020BCCA0285.htm) |
| 2021 BCSC 473 | BCSC | 2021-03-16 | [link](https://www.bccourts.ca/jdb-txt/sc/21/04/2021BCSC0473.htm) |
| 2021 BCSC 781 | BCSC | 2021-04-26 | [link](https://www.bccourts.ca/jdb-txt/sc/21/07/2021BCSC0781.htm) |
| 2021 BCSC 824 | BCSC | 2021-04-30 | [link](https://www.bccourts.ca/jdb-txt/sc/21/08/2021BCSC0824cor1.htm) |
| 2021 BCSC 905 | BCSC | 2021-05-12 | [link](https://www.bccourts.ca/jdb-txt/sc/21/09/2021BCSC0905.htm) |
| 2021 BCSC 1174 | BCSC | 2021-06-16 | [link](https://www.bccourts.ca/jdb-txt/sc/21/11/2021BCSC1174.htm) |
| 2022 BCSC 1095 | BCSC | 2022-06-29 | [link](https://www.bccourts.ca/jdb-txt/sc/22/10/2022BCSC1095.htm) |
| 2022 BCSC 1524 | BCSC | 2022-08-30 | [link](https://www.bccourts.ca/jdb-txt/sc/22/15/2022BCSC1524.htm) |
| 2022 BCSC 1449 | BCSC | 2022-09-02 | [link](https://www.bccourts.ca/jdb-txt/sc/22/14/2022BCSC1449cor1.htm) |
| 2023 BCSC 113 | BCSC | 2023-01-25 | [link](https://www.bccourts.ca/jdb-txt/sc/23/01/2023BCSC0113.htm) |
| 2023 BCCA 100 | BCCA | 2023-03-01 | [link](https://www.bccourts.ca/jdb-txt/ca/23/01/2023BCCA0100.htm) |
| 2023 BCSC 552 | BCSC | 2023-04-06 | [link](https://www.bccourts.ca/jdb-txt/sc/23/05/2023BCSC0552.htm) |
| 2024 BCSC 567 | BCSC | 2024-04-09 | [link](https://www.bccourts.ca/jdb-txt/sc/24/05/2024BCSC0567.htm) |
| 2024 BCCA 305 | BCCA | 2024-08-21 | [link](https://www.bccourts.ca/jdb-txt/ca/24/03/2024BCCA0305.htm) |
| 2024 BCSC 1952 | BCSC | 2024-10-24 | [link](https://www.bccourts.ca/jdb-txt/sc/24/19/2024BCSC1952.htm) |
| 2025 BCSC 1292 | BCSC | 2025-07-10 | [link](https://www.bccourts.ca/jdb-txt/sc/25/12/2025BCSC1292.htm) |
| 2025 BCSC 1382 | BCSC | 2025-07-18 | [link](https://www.bccourts.ca/jdb-txt/sc/25/13/2025BCSC1382.htm) |
| 2025 BCSC 1610 | BCSC | 2025-08-21 | [link](https://www.bccourts.ca/jdb-txt/sc/25/16/2025BCSC1610.htm) |
| 2025 BCSC 1694 | BCSC | 2025-09-05 | [link](https://www.bccourts.ca/jdb-txt/sc/25/16/2025BCSC1694.htm) |
| 2025 BCSC 1830 | BCSC | 2025-09-19 | [link](https://www.bccourts.ca/jdb-txt/sc/25/18/2025BCSC1830.htm) |
| 2025 BCSC 1985 | BCSC | 2025-10-09 | [link](https://www.bccourts.ca/jdb-txt/sc/25/19/2025BCSC1985cor2.htm) |
| 2026 BCSC 34 | BCSC | 2026-01-09 | [link](https://www.bccourts.ca/jdb-txt/sc/26/00/2026BCSC0034.htm) |
| 2026 BCSC 176 | BCSC | 2026-02-04 | [link](https://www.bccourts.ca/jdb-txt/sc/26/01/2026BCSC0176cor1.htm) |
| 2026 BCSC 634 | BCSC | 2026-04-13 | [link](https://www.bccourts.ca/jdb-txt/sc/26/06/2026BCSC0634.htm) |
| 2026 BCSC 1350 | BCSC | 2026-07-20 | [link](https://www.bccourts.ca/jdb-txt/sc/26/13/2026BCSC1350.htm) |
| 2026 BCSC 1620 | BCSC | 2026-07-22 | [link](https://www.bccourts.ca/jdb-txt/sc/26/16/2026BCSC1620.htm) |

## "short term accommodation"

Topic `short-term-rentals`. Not a strata-specific phrase. These need checking one by one; several are likely to be nothing to do with strata.

| Citation | Court | Date | Judgment |
|---|---|---|---|
| 2003 BCSC 1192 | BCSC | 2003-07-03 | [link](https://www.bccourts.ca/jdb-txt/sc/03/11/2003bcsc1192.htm) |
| 2007 BCSC 1436 | BCSC | 2007-09-26 | [link](https://www.bccourts.ca/jdb-txt/sc/07/14/2007bcsc1436.htm) |
| 2010 BCCA 494 | BCCA | 2010-11-05 | [link](https://www.bccourts.ca/jdb-txt/CA/10/04/2010BCCA0494.htm) |
| 2011 BCSC 233 | BCSC | 2011-02-25 | [link](https://www.bccourts.ca/jdb-txt/SC/11/02/2011BCSC0233.htm) |
| 2013 BCSC 2148 | BCSC | 2013-11-26 | [link](https://www.bccourts.ca/jdb-txt/SC/13/21/2013BCSC2148.htm) |
| 2014 BCSC 730 | BCSC | 2014-04-28 | [link](https://www.bccourts.ca/jdb-txt/SC/14/07/2014BCSC0730.htm) |
| 2016 BCSC 1631 | BCSC | 2016-09-01 | [link](https://www.bccourts.ca/jdb-txt/sc/16/16/2016BCSC1631.htm) |
| 2018 BCSC 392 | BCSC | 2018-03-13 | [link](https://www.bccourts.ca/jdb-txt/sc/18/03/2018BCSC0392.htm) |
| 2018 BCSC 752 | BCSC | 2018-05-09 | [link](https://www.bccourts.ca/jdb-txt/sc/18/07/2018BCSC0752.htm) |
| 2019 BCSC 68 | BCSC | 2019-01-22 | [link](https://www.bccourts.ca/jdb-txt/sc/19/00/2019BCSC0068.htm) |
| 2019 BCCA 64 | BCCA | 2019-02-21 | [link](https://www.bccourts.ca/jdb-txt/ca/19/00/2019BCCA0064.htm) |
| 2020 BCCA 101 | BCCA | 2020-04-07 | [link](https://www.bccourts.ca/jdb-txt/ca/20/01/2020BCCA0101.htm) |
| 2020 BCSC 601 | BCSC | 2020-04-21 | [link](https://www.bccourts.ca/jdb-txt/sc/20/06/2020BCSC0601.htm) |
| 2020 BCSC 1809 | BCSC | 2020-11-19 | [link](https://www.bccourts.ca/jdb-txt/sc/20/18/2020BCSC1809.htm) |
| 2021 BCSC 2243 | BCSC | 2021-11-19 | [link](https://www.bccourts.ca/jdb-txt/sc/21/22/2021BCSC2243cor1.htm) |
| 2023 BCSC 1060 | BCSC | 2023-06-21 | [link](https://www.bccourts.ca/jdb-txt/sc/23/10/2023BCSC1060cor1.htm) |
| 2023 BCSC 1433 | BCSC | 2023-08-22 | [link](https://www.bccourts.ca/jdb-txt/sc/23/14/2023BCSC1433.htm) |
| 2023 BCSC 1537 | BCSC | 2023-09-01 | [link](https://www.bccourts.ca/jdb-txt/sc/23/15/2023BCSC1537.htm) |
| 2024 BCSC 2240 | BCSC | 2024-12-11 | [link](https://www.bccourts.ca/jdb-txt/sc/24/22/2024BCSC2240.htm) |
| 2025 BCSC 296 | BCSC | 2025-02-24 | [link](https://www.bccourts.ca/jdb-txt/sc/25/02/2025BCSC0296cor1.htm) |
| 2025 BCCA 467 | BCCA | 2025-12-30 | [link](https://www.bccourts.ca/jdb-txt/ca/25/04/2025BCCA0467.htm) |
| 2026 BCCA 110 | BCCA | 2026-03-19 | [link](https://www.bccourts.ca/jdb-txt/ca/26/01/2026BCCA0110.htm) |

