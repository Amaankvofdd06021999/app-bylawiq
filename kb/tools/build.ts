// Usage:
//   pnpm build                        demo build: every item that passes validation, drafts included
//   pnpm build:prod                   production build: approved items only (--status=approved)
//   tsx tools/build.ts --status=reviewed   reviewed and approved items
//
// Writes:
//   dist/manifest.json   kb version, build time, filter, counts by layer and status, item index
//   dist/corpus.jsonl    one line per retrievable item: frontmatter + body + chunks
//   dist/evals.jsonl     eval items, kept out of the corpus so expected answers are never retrievable
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { KB_ROOT, STATUS_ORDER, type Frontmatter, type Status, formatReport, loadAndValidate, statusAtLeast } from './lib/kb.ts';
import { chunkBody } from './lib/chunk.ts';

function parseArgs(argv: string[]): { minStatus: Status } {
  let minStatus: Status = 'draft';
  for (const arg of argv) {
    const m = /^--status=(.+)$/.exec(arg);
    if (m) {
      if (!(STATUS_ORDER as readonly string[]).includes(m[1])) {
        console.error(`--status must be one of ${STATUS_ORDER.join(', ')}`);
        process.exit(2);
      }
      minStatus = m[1] as Status;
    } else {
      console.error(`unknown argument ${arg}`);
      process.exit(2);
    }
  }
  return { minStatus };
}

const { minStatus } = parseArgs(process.argv.slice(2));
const { items, issues } = loadAndValidate();
console.log(formatReport(issues, items.length));
if (issues.some((i) => i.level === 'error')) {
  console.error('\nBuild stopped: fix the errors above first.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(KB_ROOT, 'package.json'), 'utf8')) as { version: string };
const included = items
  .filter((i) => statusAtLeast(i.frontmatter.status, minStatus))
  .sort((a, b) => String(a.frontmatter.id).localeCompare(String(b.frontmatter.id)));
const includedIds = new Set(included.map((i) => String(i.frontmatter.id)));

const buildWarnings: string[] = [];
const corpusLines: string[] = [];
const evalLines: string[] = [];
const index: Record<string, unknown>[] = [];
const count = (rec: Record<string, number>, key: string) => { rec[key] = (rec[key] ?? 0) + 1; };
const byLayer: Record<string, number> = {};
const byStatus: Record<string, number> = {};
const byType: Record<string, number> = {};
let chunkCount = 0;

for (const item of included) {
  const fm = item.frontmatter as unknown as Frontmatter;
  const dangling = fm.cites.filter((c) => !includedIds.has(c));
  if (dangling.length) buildWarnings.push(`${fm.id} cites ${dangling.join(', ')}, which this build excludes`);
  const chunks = fm.type === 'eval' ? [] : chunkBody(fm.id, item.body);
  chunkCount += chunks.length;
  const line = JSON.stringify({ ...fm, path: item.path, body: item.body, chunks });
  (fm.type === 'eval' ? evalLines : corpusLines).push(line);
  count(byLayer, fm.layer);
  count(byStatus, fm.status);
  count(byType, fm.type);
  index.push({
    id: fm.id, layer: fm.layer, type: fm.type, title: fm.title, citation: fm.citation, status: fm.status,
    licence: fm.licence, topics: fm.topics, path: item.path, chunks: chunks.length,
    output: fm.type === 'eval' ? 'evals.jsonl' : 'corpus.jsonl',
  });
}

const corpus = corpusLines.length ? corpusLines.join('\n') + '\n' : '';
const evals = evalLines.length ? evalLines.join('\n') + '\n' : '';
const manifest = {
  name: 'bylawiq-kb',
  kb_version: pkg.version,
  built_at: new Date().toISOString(),
  status_filter: minStatus === 'draft' ? 'all statuses, drafts included, demo only' : `${minStatus} and above`,
  min_status: minStatus,
  production: minStatus === 'approved',
  corpus_sha256: createHash('sha256').update(corpus).digest('hex'),
  counts: {
    items: included.length,
    excluded_by_status: items.length - included.length,
    chunks: chunkCount,
    by_layer: byLayer,
    by_status: byStatus,
    by_type: byType,
  },
  warnings: buildWarnings,
  items: index,
};

const dist = join(KB_ROOT, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'corpus.jsonl'), corpus);
writeFileSync(join(dist, 'evals.jsonl'), evals);
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

for (const w of buildWarnings) console.warn(`warning  ${w}`);
console.log(`\nBuilt kb ${pkg.version} (${manifest.status_filter}): ${included.length} item(s), ${chunkCount} chunk(s), ${items.length - included.length} excluded by status.`);
console.log(`Wrote ${dist}/{manifest.json,corpus.jsonl,evals.jsonl}`);
