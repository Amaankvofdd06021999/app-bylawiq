# Law layer

Primary law and decisions, organised by jurisdiction. Everything here has `layer: law`.

```
law/bc/acts/<act>/            one item per section (type act-section, or schedule), plus source.json
law/bc/regulations/<reg>/     one item per section (type regulation-section), plus source.json
law/bc/decisions/crt/         CRT decisions (type crt-decision)
law/bc/decisions/courts/      BC Supreme Court and Court of Appeal decisions (type court-decision)
```

These folders are empty on purpose until research (see `research/plan.md`, R2 to R4) fills them. Do not add statute text or decision summaries from memory: every item must be checked against the source at `source_url`, and verbatim text is allowed only where its licence permits.

Every law item needs `citation`, `source_url`, `retrieved_at`, `in_force_from` and a `licence` listed in `research/licensing-register.md`. The validator enforces this.
