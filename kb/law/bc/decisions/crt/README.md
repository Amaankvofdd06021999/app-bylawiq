# CRT decisions

Civil Resolution Tribunal strata property decisions, type `crt-decision`, licence `crt-decisions` (or `canlii` for link-only items).

Each item is a structured summary with these sections, in this order:

- **Facts**
- **Issue**
- **Holding**
- **Principle**

`citation` is the neutral citation, `in_force_from` is the decision date, and `cites[]` lists the Act and Regulation sections the decision applies. Id pattern: the neutral citation, lower-case and dashed, prefixed `bc.crt.`.

Target: 50 to 100 decisions spread across the taxonomy (research plan R4). Keep a coverage table here once items exist.

## Licensing rule (enforced by the validator)

No reuse licence for CRT decisions has been found (see `research/licensing-register.md`), so until the CRT confirms reuse in writing (TODO(legal), `research/open-questions.md` item 19):

- An item is the neutral citation, a link to the decision and our own reviewed summary. Never copy the decision text. A brief attributed quotation is the most an item may carry: `tools/validate.ts` rejects more than 400 characters of block-quoted text.
- No party names anywhere. `title` and `citation` are the neutral citation (for example `2024 BCCRT 123`); the validator rejects a style of cause (`X v. Y`). Do not name parties in the body either; say "the owner", "the strata corporation".
- The four headings above are required, in that order.
- Attribution when shown: "Source: Civil Resolution Tribunal, [neutral citation], decisions.civilresolutionbc.ca".
- Never scrape the decisions site (it blocks automated clients) and never copy from CanLII.

Empty until research fills it. Never write a holding from memory.
