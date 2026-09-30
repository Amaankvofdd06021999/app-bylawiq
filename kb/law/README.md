# Law layer

Primary law and decisions, organised by jurisdiction. Everything here has `layer: law`.

```
law/bc/acts/<act>/            source.json, README.md, part-NN/ folders with one item per section (type act-section),
                              and for the Strata Property Act schedule-of-standard-bylaws/ (type schedule)
law/bc/regulations/<reg>/     source.json, README.md, part-NN/ folders with one item per section (type regulation-section)
law/bc/decisions/crt/         CRT decisions (type crt-decision)
law/bc/decisions/courts/      BC Supreme Court and Court of Appeal decisions (type court-decision)
```

The Strata Property Act (with the Schedule of Standard Bylaws) and the Strata Property Regulation are imported verbatim from BC Laws by `tools/import-bclaws.ts`; see each folder's README. The other folders are empty until research (see `research/plan.md`, R2 to R4) fills them. Do not add statute text or decision summaries from memory: every item must be checked against the source at `source_url`, and verbatim text is allowed only where its licence permits.

Every law item needs `citation`, `source_url`, `retrieved_at`, `in_force_from` and a `licence` listed in `research/licensing-register.md`. The validator enforces this. The one exception: an act, regulation or schedule section may leave `in_force_from` null when its `notes` say why (a consolidation does not state when each section's current text came into force).

Legislation items carry the King's Printer attribution requirement; the statement is in `kb/README.md` and in each act and regulation README.
