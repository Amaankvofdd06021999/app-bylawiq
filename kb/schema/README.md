# Schema

`frontmatter.schema.json` describes item frontmatter. `tools/validate.ts` reads the required fields, types, enums, patterns and formats from it, plus the `x-layer-types` and `x-layer-folders` maps, then adds cross-item rules in code (unique ids, taxonomy, cites, licences, review sign-off).
