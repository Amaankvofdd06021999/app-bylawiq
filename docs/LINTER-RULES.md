# Compliance linter rules: draft for product and counsel review

**Status: draft. Not reviewed. Not legal advice. Not legal approval.** Approval state in code: `LINTER_APPROVAL.status` is
`unreviewed`. Until it is `approved`, every finding is advisory, and no blocker stops a proposal. The linter's findings are checks for a person to
read. A lawyer confirms every legal basis and every number in `LINTER_CONFIG` before the rules are relied on, and a
reviewed change bumps `LINTER_RULES_VERSION`.

Source: PRD v3 §6.4. The implementation is `lib/bylaw-linter.ts` (rules version `2026-10-17-draft`). Tests are in
`tests/bylaw-linter.test.ts` (29 tests).

## How it works

- **Input:** the bylaw body as plain text, and whether the bylaw is an amendment to one already in force.
- **Output:** a list of findings, each with a rule id, a severity, a message, and the sentence that triggered it. Plus
  `canPropose`, which is false while any blocker is present.
- **Deterministic:** no model and no I/O. The same text always gives the same findings.
- **Sentence matching:** text is split into sentences at full stops, semicolons, question and exclamation marks, and line
  breaks. A rule fires on a sentence where it says it does.

## Severity

| Severity | Meaning | Effect |
|---|---|---|
| **blocker** | The bylaw is likely unenforceable or unlawful as written | `canPropose` is false. The PRD allows an override with a typed justification, recorded and shown to the reviewing lawyer. The override is **not built yet** |
| **warning** | Likely to cause a problem in practice | Shown to the author. Does not block |
| **info** | A reminder or a standard to consider | Shown to the author. Does not block |

## Rules

### R1 `fine_cap` (blocker)

| | |
|---|---|
| PRD check | Exceeds statutory fine cap (s.130) |
| Input | A sentence with `fine`, `fines`, `penalty`, `penalties` or `contravention`, and a dollar amount in it |
| Output | Blocker when an amount is above `LINTER_CONFIG.contraventionFineCapCents` (currently $200.00) |
| Rationale | A contravention fine above the statutory cap is not enforceable |
| Legal basis to confirm | s.130 cap amount and its current value. The PRD gives $200 as the example |
| Tests | blocks $500; allows exactly $200; blocks $200.01; reads `$1,250`; ignores a deposit amount |
| Known limits | Matches any dollar amount in a sentence about fines. A fine written in words ("two hundred dollars") is not read |

### R2 `rental_restriction` (blocker)

| | |
|---|---|
| PRD check | Rental restriction (unenforceable post Bill 44) |
| Input | A sentence with a rental noun (`rent`, `rental`, `tenant`, `tenancy`, `lease`, and their forms) and a prohibition (`prohibit`, `forbid`, `not permitted`, `restrict`, `must not`, `shall not`, or `no` before a rental noun) |
| Output | Blocker, citing the unenforceability of rental restrictions |
| Legal basis to confirm | s.126 and the Bill 44 (2022) amendments, and their current form |
| Tests | blocks "must not rent"; blocks "No rentals are permitted"; allows "Rental income is reported annually" |
| Known limits | A sentence like "No rental income is reported" matches on the word "no". This is a false positive. It is shown to the author, who can reword it |

### R3 `age_restriction` (blocker)

| | |
|---|---|
| PRD check | Age restriction other than 55+ |
| Input | A sentence with an age word (`age`, `over`, `under`, `and over`, `and older`, and similar) and a number followed by `years` or `yrs` |
| Output | Blocker when the number is not `LINTER_CONFIG.permittedMinimumAge` (55) |
| Legal basis to confirm | Bill 44 removed age restrictions except 55 and over for seniors housing |
| Tests | blocks 18 years of age or older; allows 55 years and over; does not flag a sentence with no age |
| Known limits | "over 3 years" in a non-age sentence (for example, a guest stay) is also matched. Reviewed by the author |

### R4 `service_animal` (blocker)

| | |
|---|---|
| PRD check | No accommodation for service animals |
| Input | A sentence with a pet noun (`pet`, `animal`, `dog`, `cat`, and plurals) and a prohibition. The whole body is then checked for `service animal`, `assistance animal`, `guide dog` or `support animal` |
| Output | Blocker when a pet prohibition exists and no service-animal exception appears anywhere in the body |
| Legal basis to confirm | Human Rights Code s.4 |
| Tests | blocks "No pets are permitted in the building"; allows the same sentence when "except service animals" is stated; does not flag "Two pets per unit are permitted" |
| Known limits | The exception is checked for presence, not for whether it is drafted correctly. Counsel judges the wording |

### R5 `enforcement_procedure` (warning)

| | |
|---|---|
| PRD check | Missing enforcement procedure |
| Input | A sentence with a fine word, and no reference to section 135 anywhere in the body |
| Output | Warning |
| Legal basis to confirm | s.135 enforcement procedure |
| Tests | warns on a $100 fine with no s.135 reference; no warning when s.135 is cited; no warning when no fine is set |

### R6 `vague_standard` (info)

| | |
|---|---|
| PRD check | Vague standard |
| Input | A sentence with `excessive`, `unreasonable`, `reasonable`, `nuisance`, or `disturb` and its forms, and no definition word (`means`, `defined as`, `includes`, `including`) in the body |
| Output | Info, once per body |
| Tests | notes "Excessive noise is not permitted"; not noted when defined |

### R7 `vote_threshold` (info, amendments only)

| | |
|---|---|
| PRD check | Wrong vote threshold assumed |
| Input | An amendment, and a sentence containing `majority` |
| Output | Info: amendments need a three-quarter vote (s.53) |
| Legal basis to confirm | s.53 threshold |
| Tests | notes "majority" on an amendment; not run on a new bylaw |

### R8 `filing_step` (info, amendments only)

| | |
|---|---|
| PRD check | Missing filing step |
| Input | An amendment |
| Output | Info: not effective until filed at the Land Title Office (s.128) |
| Legal basis to confirm | s.128 filing requirement |
| Tests | reminds on an amendment; not shown on a new bylaw |

## Not implemented, and why

| PRD check | Severity in PRD | Why not yet |
|---|---|---|
| Conflicts with another bylaw in this set | Warning | Needs comparison across the whole set, and a definition of "same contravention". A product and counsel decision. Not built |
| Conflicts with the municipal bylaw | Warning | Needs the municipal corpus. That is inventory item 12, blocked on counsel approval of the corpus. Not built |
| Standard bylaws comparison | Not a PRD §6.4 check | Listed under §6.6. Not built |
| Overriding a blocker with a typed justification | Blockers "can be overridden" (PRD §6.4) | The override is recorded and shown to the reviewing lawyer. It needs a database table and a review screen. Not built. Until it is built, a blocker cannot be overridden anywhere |

## Limits of the whole linter

- **It is text matching.** It misses meaning that the words do not carry, and it can match words in unexpected places. Each
  finding shows the sentence it matched so the author can judge it.
- **It does not know the rest of the building's bylaws.** It sees one body at a time.
- **It does not replace counsel.** A lawyer reviews the bylaw. The linter only reduces the number of obvious errors a
  non-lawyer makes.

## Tests (summary)

| Area | Tests |
|---|---|
| Determinism, versioning, clean bylaw | 3 |
| R1 fine cap | 6 |
| R2 rental restriction | 3 |
| R3 age restriction | 3 |
| R4 service animal | 3 |
| R5 enforcement procedure | 3 |
| R6 vague standard | 2 |
| R7 vote threshold | 2 |
| R8 filing step | 2 |
| Gating | 2 |
| **Total** | **29** |

## What is needed to close this item

1. Counsel reviews each legal basis and each value in `LINTER_CONFIG`. Changes are a reviewed commit that bumps the rules version.
2. Product reviews the severities and the wording of each message.
3. Wire the linter into the bylaw editor, so findings show while the author types. Not done yet.
4. Enforce `canPropose` on the server when a bylaw is proposed (`transition_bylaw`). Not done yet. Until it is, a blocker does not stop a proposal.
5. Build the override table and the review-screen display. Not done yet.
6. Staging acceptance: the editor shows findings on the staging build, and a proposal with a blocker is refused by the server. Not done yet.
