# Taxonomy

`topics.json` is the controlled topic vocabulary. Every item's `topics[]` must use ids from it. Each topic has `id` (stable, kebab-case), `label` (sentence case), `description` and `aliases[]` (words users type, used for query expansion). Add a topic here before using it. Never rename an id; add the old wording to `aliases` instead.
