# CRT strata decision candidates

Task C1. Decisions worth summarising, not summaries. Nothing here is a holding: the "why it
matters" column says what the decision appears to be about, so that a person can pick which ones
to summarise in Phase C3, and each one must be read in full before any item is written.

**This file is research, not a kb item.** It lives in `research/` on purpose. The task named
`law/bc/decisions/crt/candidates.md`, but every `.md` file under `law/` other than a README is
loaded as an item and shipped in `dist/corpus.jsonl`, so a candidate list there would be
retrievable — and an assistant could cite a decision nobody has read or verified. That is the
failure the whole review workflow exists to prevent, so the list sits here instead, where nothing
is shipped or validated. `law/bc/decisions/crt/README.md` points at it. See open question 34 if a
person wants it moved back.

## What is in scope, and what is not

- **Collection:** Strata Property Decisions only, final decisions only. The Intimate Images
  collection is excluded at source, as the licensing register requires.
- **Stored here:** neutral citation, decision date, topic, a one-line reason and the official URL.
  Nothing else. No decision text, no party names, no strata plan numbers, no unit numbers — the
  search results carry all of those and none of them were written down.
- **Not decided here:** whether a summary may be written at all. CRT decisions have no reuse
  licence (`crt-decisions`, unverified), so Phase C3 waits on open question 19 or on a person
  marking C3 approved.

## How the list was built, and how complete it is

**The 150 below are a curated selection. The complete collection is now indexed separately.**

`crt-index.jsonl` holds **every** decision in the tribunal's Strata Property collection as at
2026-10-01: **2832 decisions, 2016 to 2026**, one JSON object per line with the neutral citation,
the decision date, the decision type and the official URL. It was built by paging the collection by
date, 114 pages, rather than by keyword, so it is not biased towards any choice of search terms and
a later run can diff it to find what is new (task F2). 9 decisions are published without a neutral
citation, mostly default decisions; they are counted in `crt-index-uncited.json` by date and type
only, because those rows carry a style of cause and rule 6 forbids keeping the names of private
individuals.

Type breakdown: Final Decision 2785, Under Judicial Review 35, Decision After Judicial Review 34, Decision After Appeal 26, Summary Decision 25, Preliminary Decision 22, Under Appeal 9.

The curated 150 in this file came from an earlier pass that ran one keyword search per taxonomy
topic and read the first page or two of each. That pass saw 777 distinct decisions, about a quarter
of the collection, and the coverage it gives per topic is what the table below reports. It is still
the right starting point for C3 — each row carries a reason, which the index does not — but it is a
sample, and the index is the population.

Three citations are malformed on the tribunal's own site and are normalised in both files, with the
published form kept alongside: `2018  BCCRT  779` (double spaces), `2022 BCCRT1284` (no space) and
`2023-BCCRT 207` (hyphen).

Politeness, both passes: sequential requests 2 seconds apart, an identifying User-Agent, raw HTML
cached in `kb/.cache/crt/` (git-ignored), and a stop on any non-200. `robots.txt` on that host
disallows one named crawler and two specific document paths; neither was requested, and **no
decision document was fetched at all** in either pass. The earlier licensing research recorded a 403
from this host, and the ChatGPT research pack hit one on 2026-09-30; our requests returned 200. The
block is therefore intermittent, and a 403 is always a stop. The method still needs ratifying:
open question 35.

Search relevance is not a measure of importance, and a snippet can mislead. Treat the reasons as
leads.

## Coverage

| Topic | Candidates |
|---|---|
| `pets` | 10 |
| `noise` | 10 |
| `rentals` | 10 |
| `fines` | 10 |
| `bylaw-enforcement-s135` | 10 |
| `hearings` | 10 |
| `water-leaks` | 10 |
| `privacy-records` | 10 |
| `alterations-renovations` | 3 |
| `bylaw-amendment-filing` | 3 |
| `common-property-use` | 3 |
| `contingency-reserve-fund` | 3 |
| `council-governance` | 3 |
| `crt-process` | 4 |
| `depreciation-report` | 3 |
| `general-meetings-voting` | 3 |
| `harassment` | 3 |
| `hoarding-safety` | 3 |
| `human-rights-accommodation` | 4 |
| `insurance-deductibles` | 4 |
| `limited-common-property` | 4 |
| `move-in-move-out` | 3 |
| `nuisance` | 4 |
| `parking` | 3 |
| `repair-maintenance` | 4 |
| `short-term-rentals` | 4 |
| `smoking-cannabis` | 3 |
| `special-levies` | 3 |
| `strata-fees-arrears` | 3 |
| **Total** | **150** |

All 29 taxonomy topics are covered by the curated selection, the eight highest-traffic topics with 10 each. Selected dates run from 2017-02-28 to 2026-09-01.

## Pets (`pets`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 82 | 2017-09-21 | `fines`, `rentals` | A one-dog bylaw together with a new bylaw requiring a pet to be registered with council within a set period. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/235108/index.do) |
| 2018 BCCRT 176 | 2018-05-10 | — | Whether the pet bylaw was enforceable, and what pet bylaws may do: ban, limit number, limit kind, or require leashing. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/310031/index.do) |
| 2018 BCCRT 518 | 2018-09-14 | — | More pets than the bylaw allowed, met with an emotional support animal argument. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/344248/index.do) |
| 2018 BCCRT 675 | 2018-11-01 | — | A bylaw permitting listed pets and prohibiting all others, with the remedies it provided for breach. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/349239/index.do) |
| 2019 BCCRT 696 | 2019-06-07 | — | A one-dog bylaw, and later amendments governing how pets behave on common property. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/407497/index.do) |
| 2019 BCCRT 859 | 2019-07-17 | — | An ambiguous pet bylaw, with a refund of a fine already paid sought as a remedy. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/418471/index.do) |
| 2020 BCCRT 1129 | 2020-10-06 | `fines` | Exemptions from a pet restriction bylaw that were granted and then rescinded, and the fines that followed. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/486590/index.do) |
| 2021 BCCRT 400 | 2021-04-19 | — | A bylaw restricting both the number and the type of pets, with owner support for amending it. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/495757/index.do) |
| 2024 BCCRT 781 | 2024-08-16 | `alterations-renovations` | A pet fence installed in order to satisfy the pet bylaw, and fines imposed over the fence itself. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/526559/index.do) |
| 2026 BCCRT 763 | 2026-05-15 | — | Three dogs under a one-pet bylaw, with unregistered pets, unleashed pets on common property and animal waste. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529631/index.do) |

## Noise (`noise`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 107 | 2017-11-06 | — | Amended nuisance, unreasonable noise and interference bylaws construed together. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/236737/index.do) |
| 2019 BCCRT 74 | 2019-01-18 | — | The standard use bylaw applied to a noise complaint where no other bylaw had been filed. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/361225/index.do) |
| 2020 BCCRT 238 | 2020-02-28 | — | Breach of the nuisance, unreasonable noise and unreasonable interference limbs, including night-time noise. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/462207/index.do) |
| 2021 BCCRT 306 | 2021-03-19 | — | Once unreasonable noise is established the strata must act to stop the contravention; whether it continued after mediation. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/494520/index.do) |
| 2021 BCCRT 456 | 2021-04-30 | — | Whether the noise was unreasonable, who caused it, and whether the strata investigated and enforced. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/496317/index.do) |
| 2022 BCCRT 532 | 2022-05-04 | — | Whether the owners of a lot breached the noise bylaw. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521567/index.do) |
| 2022 BCCRT 930 | 2022-08-18 | — | Draws a line between the ordinary noise of shared buildings and disruptive, unreasonable noise. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/522278/index.do) |
| 2023 BCCRT 327 | 2023-04-21 | — | The standard use bylaw serving as the noise bylaw, with its three limbs set out. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/523575/index.do) |
| 2023 BCCRT 684 | 2023-08-15 | — | Whether acoustic consultant reports establish that noise was unreasonable. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/524264/index.do) |
| 2024 BCCRT 042 | 2024-01-16 | `nuisance` | Flooring noise from the lot above, and the point that only unreasonable noise is prohibited. Note: the citation is printed with a leading zero on the CRT site; verify before creating an item. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/525121/index.do) |

## Rentals (`rentals`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2018 BCCRT 29 | 2018-02-08 | — | Whether a rental restriction bylaw reached the renting of part of a lot, and its enforceability. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/306061/index.do) |
| 2018 BCCRT 325 | 2018-07-12 | — | A 3/4 vote ratifying the bylaws excluding a rental restriction passed while the rental restriction vote itself failed. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/315980/index.do) |
| 2018 BCCRT 782 | 2018-12-07 | — | An exemption from a rental restriction bylaw arising because the strata did not answer the request within the deadline then in force. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/351431/index.do) |
| 2019 BCCRT 274 | 2019-03-07 | `short-term-rentals` | A bylaw restricting leases is a bylaw restricting rentals, the two being synonymous in the Act. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/365021/index.do) |
| 2019 BCCRT 772 | 2019-06-25 | — | A rental pool deemed non-residential in order to sit outside a rental restriction bylaw. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/417470/index.do) |
| 2021 BCCRT 268 | 2021-03-09 | — | Which version of a rental restriction bylaw applied, given when the tenants moved in and when the bylaw was replaced. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/494044/index.do) |
| 2021 BCCRT 1134 | 2021-10-25 | `fines` | Whether a rental restriction bylaw reached renting part of a lot, and whether the fines followed the required procedure. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/514921/index.do) |
| 2022 BCCRT 275 | 2022-03-11 | — | Section 141 does not reach a bylaw restricting use and occupancy, only one restricting rentals; a use bylaw survived where the rental limb did not. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521147/index.do) |
| 2022 BCCRT 633 | 2022-05-30 | — | Whether the vote on a rental restriction bylaw was properly held, and whether the amended bylaw breached the Act. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521743/index.do) |
| 2023 BCCRT 53 | 2023-04-04 | — | States the position squarely: section 141 prohibits restricting rentals, so a rental restriction bylaw contravenes it and is unenforceable. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/523090/index.do) |

## Fines (`fines`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 117 | 2017-11-16 | — | Reads a fine bylaw as setting a range up to a maximum per contravention rather than a fixed amount. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/301071/index.do) |
| 2018 BCCRT 155 | 2018-04-27 | `short-term-rentals` | A bylaw raising maximum fines, with higher figures for rental limitation and short-term accommodation bylaws, tested against the regulated maximum. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/309470/index.do) |
| 2020 BCCRT 284 | 2020-03-11 | — | Fines exceeding the maximum the bylaws set for rule contraventions, against the standard bylaw's rule maximum. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/465511/index.do) |
| 2020 BCCRT 1092 | 2020-09-29 | `short-term-rentals` | A bylaw held clear enough to set a $1,000 maximum per contravention, and the power to set different maximums for different bylaws. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/486031/index.do) |
| 2021 BCCRT 38 | 2021-01-29 | — | A bylaw setting tiered maximums, including a daily maximum for one particular bylaw. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/491256/index.do) |
| 2021 BCCRT 118 | 2021-02-01 | `short-term-rentals` | Act section 132 read with the Regulation's maximum amounts and maximum frequency provisions. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/492106/index.do) |
| 2021 BCCRT 1206 | 2021-11-15 | `rentals` | Fines invalid for failure to follow the statutory procedure, where the standard bylaw maximum still applied. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/516089/index.do) |
| 2022 BCCRT 491 | 2022-04-27 | — | Bylaws that did not say which maximum applied to which bylaw or rule, and fines that exceeded the applicable maximum. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521506/index.do) |
| 2024 BCCRT 414 | 2024-05-01 | `rentals` | A bylaw allowing a fine every 7 days for a continuing breach, and a Regulation change affecting the maximum amount. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/526045/index.do) |
| 2025 BCCRT 1194 | 2025-08-27 | `rentals`, `short-term-rentals` | Distinguishes fining for advertising from fining for the accommodation itself, and fixes the maximum and frequency accordingly. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/528285/index.do) |

## Bylaw enforcement and s.135 (`bylaw-enforcement-s135`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 23 | 2017-05-16 | — | A fine imposed before any complaint was received and before particulars were given; the fine was waived. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/230984/index.do) |
| 2018 BCCRT 426 | 2018-08-09 | `pets` | What "particulars of the complaint" requires, and whether it means handing over copies of the complaint letters. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/317512/index.do) |
| 2019 BCCRT 284 | 2019-03-08 | — | Treats section 135 as strict: without compliance there is no entitlement to fine, the opportunity to answer must be reasonable, and the purpose is procedural fairness. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/365231/index.do) |
| 2019 BCCRT 1311 | 2019-11-20 | — | Sets out the section 135 (1) elements one by one, including a hearing where one is requested. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/424766/index.do) |
| 2019 BCCRT 1360 | 2019-12-03 | `pets` | An owner asking the strata to demonstrate it had complied with section 135 before fining, and a failure to give written particulars. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/453789/index.do) |
| 2020 BCCRT 1443 | 2020-12-21 | `pets` | Section 135 (2) notice of the decision as soon as feasible, and the section 135 (3) shortcut for a continuing contravention once the section has been complied with. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/490451/index.do) |
| 2022 BCCRT 56 | 2022-01-14 | — | Section 135 (1) elements, plus a finding that noise complaints are not continuous, which limits the continuing-contravention shortcut. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/519544/index.do) |
| 2022 BCCRT 191 | 2022-02-22 | — | Section 135 (1) applied to fines for both bylaw and rule contraventions. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521001/index.do) |
| 2024 BCCRT 382 | 2024-04-22 | — | Council must consider a complaint at its next meeting and give its decision in writing; no written decision meant the section was not complied with. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/525995/index.do) |
| 2026 BCCRT 1255 | 2026-08-26 | `short-term-rentals` | How much detail the section 135 particulars must contain, in a short-term accommodation fine. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/530123/index.do) |

## Hearings (`hearings`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 75 | 2017-09-11 | `privacy-records` | A bylaw tracking the repealed standard bylaw 15, read against the section 34.1 hearing right that replaced it. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/234631/index.do) |
| 2017 BCCRT 101 | 2017-10-25 | — | A hearing requested by a tenant was never held; applies the Regulation's definition of a hearing. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/236408/index.do) |
| 2017 BCCRT 102 | 2017-10-26 | — | A hearing requested under the bylaws, and how that interacts with the statutory right to one. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/236421/index.do) |
| 2018 BCCRT 91 | 2018-03-22 | — | The four-week deadline to hold a hearing after a written request. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/307727/index.do) |
| 2021 BCCRT 620 | 2021-06-07 | — | Whether council has any discretion to refuse a hearing request. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/498306/index.do) |
| 2021 BCCRT 725 | 2021-07-02 | `privacy-records` | What a written application stating the reason for the request has to contain. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/499691/index.do) |
| 2022 BCCRT 617 | 2022-05-26 | — | A hearing was held; the question was whether what happened met the requirement. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521725/index.do) |
| 2022 BCCRT 708 | 2022-06-17 | — | The four-week deadline together with the definition of a hearing as being heard in person at a council meeting. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521891/index.do) |
| 2026 BCCRT 86 | 2026-01-20 | — | An allegedly improper hearing framed as significant unfairness, with damages sought. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/528961/index.do) |
| 2026 BCCRT 674 | 2026-04-29 | — | Whether the request met the section 34.1 requirements at all, which the strata disputed. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529541/index.do) |

## Water leaks (`water-leaks`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2018 BCCRT 791 | 2018-12-03 | — | Four separate leaks from the lot above into the lot below. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/351443/index.do) |
| 2019 BCCRT 570 | 2019-05-13 | — | An unconfirmed leak source attributed to the exterior of the building. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/405754/index.do) |
| 2019 BCCRT 578 | 2019-05-14 | — | An emergency report identifying a fixture in the lot above as the likely cause. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/405840/index.do) |
| 2019 BCCRT 885 | 2019-07-19 | — | No sign of leaking found once walls were opened, despite a damage estimate. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/418798/index.do) |
| 2019 BCCRT 1366 | 2019-12-06 | — | No visible damage immediately after the leaks, with stains appearing many months later. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/453934/index.do) |
| 2020 BCCRT 1392 | 2020-12-09 | — | Whether the owner "caused" the leak within the meaning of the chargeback bylaws. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/489891/index.do) |
| 2021 BCCRT 72 | 2021-01-20 | — | Water pressure on restoration of the supply causing leaks through the building, and the part a plumber's actions played. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/491608/index.do) |
| 2021 BCCRT 973 | 2021-09-07 | — | Whether there had been a leak from the respondent's lot at all. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/512579/index.do) |
| 2022 BCCRT 116 | 2022-01-31 | — | A common property pipe leaking into a lot, and repairs the owner wanted that fell outside the insurance claim. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/520436/index.do) |
| 2024 BCCRT 1181 | 2024-11-21 | — | Notes that leak disputes between owners usually fall in the tribunal's small claims jurisdiction as debt or damages claims. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/526962/index.do) |

## Privacy and records (`privacy-records`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 97 | 2017-10-18 | — | The two-week deadline to provide records after a request. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/236377/index.do) |
| 2017 BCCRT 141 | 2017-12-18 | — | Access refused over several years, examined category of record by category. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/303866/index.do) |
| 2020 BCCRT 444 | 2020-04-23 | — | Two weeks for records generally, one week for the bylaws and rules. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/469803/index.do) |
| 2020 BCCRT 1445 | 2020-12-21 | — | An owner does not have to give a reason for a records request. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/490452/index.do) |
| 2021 BCCRT 634 | 2021-06-09 | — | The Regulation's retention periods read together with the duty to produce records on request. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/498488/index.do) |
| 2022 BCCRT 681 | 2022-06-09 | — | Inspection of records at the strata manager's place of business. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521843/index.do) |
| 2022 BCCRT 831 | 2022-07-21 | — | The list of owners as a record the strata must prepare, retain and produce. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/522109/index.do) |
| 2023 BCCRT 1090 | 2023-12-12 | — | A refusal to provide copies of the records an owner had listed in a written request. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/524911/index.do) |
| 2024 BCCRT 1102 | 2024-10-31 | — | Who may make a records request: a tenant with assigned rights, or a person authorised in writing. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/526882/index.do) |
| 2026 BCCRT 951 | 2026-06-22 | — | Only the records the Act lists must be produced, with limits on correspondence. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529821/index.do) |

## Alterations and renovations (`alterations-renovations`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2021 BCCRT 1151 | 2021-10-29 | `hearings` | Common property altered after the strata expressly refused approval; applies standard bylaw 6 (1) and a permit condition. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/515223/index.do) |
| 2023 BCCRT 931 | 2023-10-30 | — | A bylaw letting the strata require, as a condition of approval, that the owner take responsibility for current and future expenses of the alteration. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/524656/index.do) |
| 2024 BCCRT 291 | 2024-03-20 | `common-property-use` | Whether the changes were alterations to common or limited common property at all, which decides whether approval was needed. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/525785/index.do) |

## Bylaw amendment and filing (`bylaw-amendment-filing`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 86 | 2017-10-03 | — | Bylaws relied on in enforcement had never been filed in the land title office, so they were not the strata's bylaws. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/235627/index.do) |
| 2019 BCCRT 994 | 2019-08-21 | — | An alteration policy referred to in the bylaws but never filed at the land title office is not part of the bylaws. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/420316/index.do) |
| 2019 BCCRT 1100 | 2019-09-18 | `general-meetings-voting` | Alleged bylaw amendment without a 3/4 vote; a title search used to establish the last amendment actually filed. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/421687/index.do) |

## Common property use (`common-property-use`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2023 BCCRT 229 | 2023-03-20 | — | Whether the strata's own common property repair was itself a significant change needing an owners' vote. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/523398/index.do) |
| 2024 BCCRT 1050 | 2024-10-21 | — | Unauthorised changes to, and exclusive use of, common property; section 71 read with the exclusive-use power in section 76. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/526830/index.do) |
| 2026 BCCRT 853 | 2026-06-02 | — | Whether section 71 applies to limited common property, and the test for a significant change. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529721/index.do) |

## Contingency reserve fund (`contingency-reserve-fund`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 11 | 2017-03-03 | `bylaw-amendment-filing` | Money moved out of the contingency reserve fund into a separate holding account, and whether that expenditure was authorised. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/229958/index.do) |
| 2017 BCCRT 58 | 2017-08-15 | — | Contingency reserve fund expenditures approved at a special general meeting, and whether the cost summary accounted for them. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/233766/index.do) |
| 2026 BCCRT 781 | 2026-05-20 | `special-levies` | Owners defeated resolutions to fund work from the reserve fund and by special levy; whether the work needed an immediate expenditure. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529650/index.do) |

## Council and governance (`council-governance`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2019 BCCRT 948 | 2019-08-08 | `hearings` | The section 31 standard of care advanced as a claim in its own right, separate from the other statutory duties. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/419477/index.do) |
| 2020 BCCRT 1354 | 2020-11-30 | — | A section 31 standard of care claim advanced without any remedy being requested. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/489313/index.do) |
| 2025 BCCRT 187 | 2025-02-10 | — | A strata corporation alleging that one of its own council members breached the section 31 standard of care. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/527280/index.do) |

## Civil Resolution Tribunal process (`crt-process`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2018 BCCRT 546 | 2018-09-21 | — | The tribunal's remedial provision mirrors the significant unfairness wording of Act section 164. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/344902/index.do) |
| 2019 BCCRT 1439 | 2019-12-24 | — | The relationship between Act section 164, which speaks to the court, and the tribunal's own power to remedy a significantly unfair act. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/458731/index.do) |
| 2020 BCCRT 1239 | 2020-11-02 | — | Tribunal jurisdiction over significant unfairness, resting on the parallel wording in the Civil Resolution Tribunal Act. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/487957/index.do) |
| 2022 BCCRT 279 | 2022-03-14 | `privacy-records` | Damages sought as a penalty for significant unfairness in failing to meet the records disclosure duty. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521164/index.do) |

## Depreciation report (`depreciation-report`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2021 BCCRT 548 | 2021-05-20 | — | "Any depreciation reports" in the records provision covers draft reports as well as final ones. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/497441/index.do) |
| 2023 BCCRT 771 | 2023-09-12 | — | A depreciation report recommending a building envelope assessment, and what the strata did in response. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/524412/index.do) |
| 2024 BCCRT 278 | 2024-03-18 | `general-meetings-voting` | A failed waiver resolution, and whether lack of funds excuses not obtaining a depreciation report. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/525760/index.do) |

## General meetings and voting (`general-meetings-voting`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2018 BCCRT 923 | 2018-12-28 | — | Roofing material and colour changed without the 3/4 vote required, with the notice provisions considered. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/356937/index.do) |
| 2022 BCCRT 562 | 2022-05-11 | — | Whether the bylaws allowed an outside lawyer to chair annual and special general meetings. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521631/index.do) |
| 2022 BCCRT 795 | 2022-07-12 | `depreciation-report` | A resolution waiving the depreciation report requirement had to be renewed at each annual general meeting. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/522046/index.do) |

## Harassment (`harassment`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2021 BCCRT 331 | 2021-03-29 | — | Harassment allegations against other owners and against council members, and the limits of what the tribunal will resolve. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/494774/index.do) |
| 2021 BCCRT 946 | 2021-08-30 | — | How council dealt with a harassment complaint made against council, and transparency about it with owners. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/512245/index.do) |
| 2021 BCCRT 1010 | 2021-09-17 | `parking` | Harassment by council treated as engaging the council member standard of care. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/513098/index.do) |

## Hoarding and safety (`hoarding-safety`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2018 BCCRT 507 | 2018-09-10 | — | A fire department hoarding policy and the range of hazards the strata relied on. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/344205/index.do) |
| 2021 BCCRT 1096 | 2021-10-15 | — | Hoarding as a fire and safety hazard with a resulting infestation, and the orders the strata sought. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/514459/index.do) |
| 2025 BCCRT 11 | 2025-01-06 | — | A bylaw against creating a fire risk or contravening the insurance policies, and what weight to give fire department inaction. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/527104/index.do) |

## Human rights and accommodation (`human-rights-accommodation`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2021 BCCRT 712 | 2021-06-30 | — | Once the duty to accommodate is triggered, a higher duty to investigate smoke and odour complaints follows. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/499496/index.do) |
| 2021 BCCRT 901 | 2021-08-17 | — | Whether a disability triggering the duty to accommodate had been proven. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/511710/index.do) |
| 2022 BCCRT 515 | 2022-05-03 | — | The applicant must prove a disability before the duty to accommodate is engaged at all. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521558/index.do) |
| 2022 BCCRT 1284 | 2022-11-29 | `smoking-cannabis` | Medical evidence of a disability without persuasive evidence that the particular accommodation sought was required. Note: the citation is printed without a space on the CRT site; verify before creating an item. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/522830/index.do) |

## Insurance and deductibles (`insurance-deductibles`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 46 | 2017-07-27 | — | The Act expressly provides for charging an insurance deductible back to an owner. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/233352/index.do) |
| 2024 BCCRT 1208 | 2024-11-28 | — | A deductible chargeback under a bylaw required proof of an act or failure to act that caused the damage. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/526992/index.do) |
| 2025 BCCRT 1645 | 2025-11-26 | — | A deductible chargeback after a leak caused by a contractor the owner had engaged. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/528733/index.do) |
| 2026 BCCRT 339 | 2026-02-27 | — | Whether the strata charged the deductible to the owners properly. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529209/index.do) |

## Limited common property (`limited-common-property`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 25 | 2017-06-05 | — | Who must provide a handrail on limited common property balcony stairs. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/231650/index.do) |
| 2019 BCCRT 1207 | 2019-10-21 | — | Damage to a balcony from a bird's nest, and whether the bylaws put repair of limited common property on the strata. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/423420/index.do) |
| 2020 BCCRT 992 | 2020-09-04 | — | A deck, exterior stairs and a roof added to limited common property balconies, and who repairs the additions. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/484845/index.do) |
| 2025 BCCRT 211 | 2025-02-13 | — | A bylaw requiring owners to keep limited common property clear, read against the strata's own repair duty. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/527304/index.do) |

## Move-in and move-out (`move-in-move-out`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 10 | 2017-02-28 | — | Move-in and move-out fees charged when occupants changed without any furniture being moved. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/229957/index.do) |
| 2022 BCCRT 567 | 2022-05-12 | — | Whether a move-in fee was unreasonable and whether it applied to occupation under a licence; treats a move-in fee as a user fee. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/521636/index.do) |
| 2026 BCCRT 313 | 2026-02-24 | — | Whether the tribunal should decide that a move-in fee is unreasonable, and order a refund. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529183/index.do) |

## Nuisance (`nuisance`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2022 BCCRT 923 | 2022-08-15 | `smoking-cannabis` | The nuisance, hazard and unreasonable interference limbs applied to smoke from a neighbouring lot. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/522262/index.do) |
| 2025 BCCRT 1162 | 2025-08-20 | — | Barbecue use as a nuisance or hazard under the use bylaw. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/528252/index.do) |
| 2026 BCCRT 995 | 2026-07-02 | `smoking-cannabis` | Smoking found to create both a hazard and a nuisance under several limbs of the use bylaw. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529861/index.do) |
| 2026 BCCRT 1269 | 2026-09-01 | `human-rights-accommodation`, `limited-common-property`, `privacy-records`, `smoking-cannabis` | Repeated breaches of a balcony smoking bylaw together with the nuisance bylaw; hazard and legal nuisance both found. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/530135/index.do) |

## Parking (`parking`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2019 BCCRT 179 | 2019-02-15 | — | Visitor parking passes and towing where the strata plan showed no visitor stalls at all. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/363508/index.do) |
| 2019 BCCRT 958 | 2019-08-09 | — | Reassignment of parking stalls, and the limits on the strata's authority to reassign. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/419667/index.do) |
| 2025 BCCRT 573 | 2025-05-07 | — | A bylaw amendment that took away access to a second parking stall. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/527666/index.do) |

## Repair and maintenance (`repair-maintenance`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2017 BCCRT 111 | 2017-11-08 | — | The different tests in the two limbs of section 72, and why an owner remained responsible for an alteration. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/301023/index.do) |
| 2024 BCCRT 88 | 2024-01-29 | — | A reasonable expectation that the strata would meet its section 72 repair duty, considered after judicial review. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/520810/index.do) |
| 2025 BCCRT 1781 | 2025-12-29 | — | An owner can be made responsible for repairing common property only where the Regulation permits it, and it does not. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/528868/index.do) |
| 2026 BCCRT 984 | 2026-06-30 | — | Whether "repair and maintenance" in section 72 extends to the cost of replacement. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529848/index.do) |

## Short-term rentals (`short-term-rentals`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2019 BCCRT 1205 | 2019-10-18 | `rentals` | A use bylaw barring transient and short-term accommodation, hotel-like use and bed and breakfast operation. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/423279/index.do) |
| 2020 BCCRT 279 | 2020-03-10 | — | Many separate contraventions of short-term accommodation bylaws, and the total fines that followed. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/465461/index.do) |
| 2024 BCCRT 449 | 2024-05-13 | — | Two overlapping bylaws restricting short-term accommodation, with orders sought to stop both advertising and use. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/526122/index.do) |
| 2026 BCCRT 680 | 2026-04-29 | `fines` | A residential section's own bylaws setting the terms for stays under a month and capping how many lots may be used that way. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529549/index.do) |

## Smoking and cannabis (`smoking-cannabis`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2023 BCCRT 1083 | 2023-12-11 | — | Smoking addressed under the nuisance bylaws where the bylaws contained no smoking restriction. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/524903/index.do) |
| 2026 BCCRT 899 | 2026-06-11 | `nuisance` | Designated smoking areas created by rule under a bylaw, and the effect of adopting a new no-smoking bylaw. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529766/index.do) |
| 2026 BCCRT 1121 | 2026-07-28 | — | Validity of smoking bylaws where smoking had been permitted when the complainant bought, and a bylaw requiring owners to bring the smoking bylaws to occupants' attention. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529993/index.do) |

## Special levies (`special-levies`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2018 BCCRT 547 | 2018-09-24 | `crt-process` | Levy money moved between two separate special levies, and the point that the reserve fund provision does not apply to special levies. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/344903/index.do) |
| 2020 BCCRT 294 | 2020-03-13 | — | A defeated special levy resolution, and whether the Act requires a contribution to be refunded. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/465844/index.do) |
| 2022 BCCRT 1172 | 2022-10-25 | — | Whether the refund provision governs unused special levy funds where the levy was not a typical one. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/522661/index.do) |

## Strata fees and arrears (`strata-fees-arrears`)

| Citation | Date | Also relevant to | Why it matters | Decision |
|---|---|---|---|---|
| 2019 BCCRT 968 | 2019-08-14 | `contingency-reserve-fund`, `depreciation-report` | Enforcing strata fee arrears by registering a lien against title. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/419812/index.do) |
| 2019 BCCRT 971 | 2019-08-14 | — | Arrears made up of fees, special levies, interest and returned-payment charges, with the strata's legal fees also claimed. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/419813/index.do) |
| 2026 BCCRT 801 | 2026-05-22 | — | A warning letter threatening a lien over arrears that included a special levy instalment, followed by a demand letter. | [link](https://decisions.civilresolutionbc.ca/crt/sd/en/item/529672/index.do) |

