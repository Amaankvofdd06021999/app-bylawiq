// Usage: pnpm validate
// Walks kb/, checks every item against schema/frontmatter.schema.json and the cross-item rules,
// prints a report, and exits 1 if there are errors. Warnings do not fail the run.
import { loadAndValidate, formatReport } from './lib/kb.ts';

const { items, issues } = loadAndValidate();
console.log(formatReport(issues, items.length));
if (issues.some((i) => i.level === 'error')) process.exit(1);
