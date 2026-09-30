# Progress log

Append-only, newest at the bottom. One entry per research-bot session. The task queue lives in
`research-bot-plan.md` §6; this file records what was actually done, what was skipped and why.

## 2026-09-30 — session 2

- Done: **A1, cross-references in the Strata Property Act and Regulation.** Built
  `tools/lib/cites.ts` and `pnpm link:cites` to read each section's own text and fill `cites[]`,
  then wrote the links: 237 of 423 statute items now carry 577 cites. 20 items hand-checked
  (below). `pnpm validate` 0 errors, `pnpm test` 77 pass, `pnpm build` 427 items / 1159 chunks,
  kb 0.2.1.
- Items added: 0 · updated: 237 (153 Act sections, 79 Regulation sections, 5 standard bylaws).

### How references were resolved

A reference becomes a cite only when the text says which enactment it means. Inside the Act a bare
"section 135" is the Act; inside the Regulation it is the Regulation, and "of the Act" is the Act.
Four BC Laws drafting habits each needed handling, and each was found in a real item, read in the
source, and covered by a test:

- An italicised marginal note between the number and the enactment: "section 168.33 or 168.43
  *[supporting documents]* of the *Land Title Act*" (Act s. 256 (1.1)). Without this the two
  *Land Title Act* sections looked like sections of our own Act.
- Consecutive bare subsections: "section 69 (1) (b) and (2) (b) of the Act" (Regulation s. 17.6).
- A repeated lead word carrying one trailing qualifier: "section 12 (2) and (3) (a) and section 13
  (2) (b) of the Act" (Regulation s. 3.01). The repeat must be the same kind of unit, so
  "Division 10 of Part 10 and section 324 of the *Business Corporations Act*" (Act s. 276 (2))
  stays three separate references.
- A qualifier stated once in the stem above a list of paragraphs (Regulation s. 17.23, which lists
  Act ss. 16, 40, 43, 51, 159 and 230 as bare numbers). Resolved by the Regulation's own numbering:
  every section of the Regulation is numbered N.M, so an unqualified whole number in a Regulation
  item is necessarily a section of the Act. Each of the six was verified against the Act section's
  title, which matches the Regulation's marginal note word for word. A list mixing the two shapes
  is left with the Regulation so the mismatch is reported rather than guessed.

Ranges ("sections 112 to 118", "sections 175 to 189 of the Act") are expanded over the sections the
kb actually holds, in BC Laws numbering order, so 178.1 is correctly included between 178 and 179.
Nothing is invented: a reference to a section the kb does not hold is reported, not cited.

### Hand-checked (20)

`bc.spa.s135` (none), `bc.spa.s130` (none), `bc.spa.s164` (none), `bc.spa.s34.1` (none),
`bc.spa.sched.bylaw1` (none), `bc.spa.sched.bylaw23` (none), `bc.spa.sched.bylaw24` (none),
`bc.spa.s20`, `bc.spa.s256`, `bc.spa.s276`, `bc.spa.s292` (37 cites, the largest),
`bc.spa.sched.bylaw7`, `bc.spr.s3.01`, `bc.spr.s7.1`, `bc.spr.s13.4`, `bc.spr.s14.11`,
`bc.spr.s17.6`, `bc.spr.s17.9`, `bc.spr.s17.16` (range 175–189), `bc.spr.s17.23`. All correct.

### Not cited, by design

- **Other enactments (48 references, 17 distinct).** No kb item to cite: *Condominium Act* (17),
  *Land Title Act* (7), *Business Corporations Act* (4), *Civil Resolution Tribunal Act* (4),
  *Land Surveyors Act* (3), *Residential Tenancy Act* (2), and one each of the *Building Act*,
  *Electrical Safety Regulation*, *Financial Institutions Act*, *Financial Services Authority Act*,
  *Fire Safety Act*, *Interpretation Act*, *Offence Act*, *Real Estate Services Act*, *School Act*,
  *shíshálh Nation Self-Government Act* and *Utilities Commission Act*.
  After A4 to A6 import the Civil Resolution Tribunal Act, Human Rights Code and Residential
  Tenancy Act, the 6 references to two of those Acts could resolve; `link:cites` would need a map
  from an Act's name to its id prefix. Noted as work inside A4 to A6, not a new task.
- **Parts and Divisions (26 references, 17 distinct).** The kb holds one item per section, so a
  reference to Part 7, Part 10.1, "Parts 1 to 17" or Division 2 has nothing to cite. Recorded here
  so the gap is visible; whether to add Part-level items is a question for a person (not raised as
  an open question because nothing is blocked by it today).
- **Amendment histories.** The `[en. B.C. Reg. 117/2020, s. 2; am. ...]` notes at the foot of each
  item cite the amending enactment's own section, not a Strata Property Act section, and are never
  read as cross-references. They are the raw material for A2.
- **Repealed sections.** No item references a repealed section, so no reference was dropped for
  being absent from the kb: the `not-in-kb` bucket is empty.
- **Unqualified bylaw numbers.** None occur outside the Schedule. If one appears, it is reported
  rather than cited, because in the Act a bylaw number may be a strata's own bylaw and not a
  standard one.

### Notes for the next session

`pnpm link:cites` is re-runnable and idempotent, and its output format matches
`tools/import-bclaws.ts`, so run it after every BC Laws sync (F1) and after A4 to A6.

- Next: A2, in-force dates from the Tables of Legislative Changes.
