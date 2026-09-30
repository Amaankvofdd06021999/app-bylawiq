# Evals

One file per topic, type `eval`, layer `topic`. Each file lists questions with expected answer points, required citations (kb ids) and things the answer must not say. At least one question per topic must expect the "no grounding found" state.

Evals are built into `dist/evals.jsonl` and never into `dist/corpus.jsonl`, so expected answers can never be retrieved.
