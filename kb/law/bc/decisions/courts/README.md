# Court decisions

Key BC Supreme Court and Court of Appeal strata decisions, type `court-decision`, licence `court-decisions` (or `canlii` for link-only items). Same Facts, Issue, Holding, Principle structure as CRT decisions. Id prefix `bc.bcsc.` or `bc.bcca.` followed by the lower-case neutral citation.

## Licensing rule (enforced by the validator)

The BC courts require written permission to use published decisions in a user-pay legal research tool (see `research/licensing-register.md`). Until permission is granted (TODO(legal), `research/open-questions.md` item 18):

- An item is the citation, a link to bccourts.ca or CanLII and our own lawyer-reviewed summary of the principle. No full text and no excerpts: `tools/validate.ts` rejects more than 400 characters of block-quoted text and requires the Facts, Issue, Holding, Principle headings.
- Name the court as the source. Do not suggest affiliation with or endorsement by the courts.
- Never download from the judgment database (disallowed in robots.txt) or from CanLII.

Respect publication bans. Empty until research fills it (research plan R4).

## Candidates

The list of judgments to read is **`research/decision-candidates/courts.md`** (127 judgments, BCSC
and BCCA, 2002 to 2026), kept in `research/` for the same reason as the CRT list: nothing under
`law/` can hold research material without shipping it to retrieval.

That list has no "why it matters" column. `robots.txt` on bccourts.ca disallows `/jdb-txt/`, where
the judgments themselves live, so they cannot be read by an automated client; the search results
pages, which are allowed, carry no snippet. The list records which phrase found each judgment, which
is the only subject-matter signal the permitted pages give. Finishing the task needs a person with a
browser, or the permission in open question 18.
