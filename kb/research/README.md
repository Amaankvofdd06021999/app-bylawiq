# Research

Working notes for filling the knowledge base. Nothing in this folder is shipped or validated as an item.

- `plan.md`: the research plan, workstreams R1 to R8.
- `research-bot-plan.md`: operating instructions and task queue for the research bot that fills the kb.
- `progress-log.md`: the research bot's session log (created on its first run).
- `coverage.md`: **what has been gathered and what has not**, with counts and the reason for each gap. Read this first.
- `source-register.md`: every source we use and where it lands.
- `licensing-register.md`: licence ids used in item frontmatter. The validator reads ids from this table.
- `open-questions.md`: questions that block or shape the work.
- `decision-candidates/`: CRT and court decisions worth summarising, for Phase C. Leads, not findings.

## The ChatGPT research pack

`kb/BylawIQ_Research_Pack_2026-09-30/` was supplied on 2026-10-01 from a separate research effort.
It is committed because this folder's registers now cite it, so the references have to resolve.

Read it as **leads, not findings**. Its own README says it had no access to this repository, asserts
no item ids or counts, and should not be indexed. Nothing in it has been treated as verified law.
Where it pointed at a provision, that provision was read in the Act or Regulation in this kb before
anything was written.

What it has been used for so far, on 2026-10-01:

- It flagged the **electrical planning report** deadlines, which this register had missed entirely.
  Verified against Act s. 94.1 and Regulation Part 5.2, which were in the kb and untagged. Two
  topics, two guides, two eval sets, a tracker entry and a checklist entry followed.
- It **independently confirmed** the BC Laws robots.txt block (question 24), which turns a single
  reading into a settled fact.
- It recorded a **403 on the CRT decisions portal** on the same day a request of ours returned 200,
  so that block is intermittent and a 403 must always be treated as a stop (question 35).
- About 30 of its 40 sources were new to `source-register.md` and are now recorded there by
  publisher, including the province's own strata guidance pages, the BC Human Rights Tribunal, the
  LTSA, BCFSA and an official update subscription (questions 36 and 37).
- Its legislation scope and topic proposals became questions 38 and 39.

Two files at `kb/` root, `BylawIQ_KB_Research_Dossier_2026-09-30.md` and `Evidence_and_Sources.md`,
are byte-identical copies of files inside the pack folder. They are harmless — nothing outside
`law/`, `firm-starter/`, `building-starter/`, `topics/` and `evals/` is loaded as an item — but they
could be deleted, and the pack folder could move under `research/`, where it architecturally
belongs. Both left alone pending a decision.
