// Usage:
//   pnpm link:cites            report the cites[] every Act, Regulation and Schedule item should have
//   pnpm link:cites --write    write them into the items
//   pnpm link:cites --details  also list every reference that cannot be cited, with the text it came from
//
// Fills `cites[]` on statute items from the cross-references in their own text ("section 135",
// "sections 112 to 118", "section 45 of the Act"). Only references that name an enactment the kb
// holds become cites. References to other Acts, to Parts (the kb has no Part items), to sections the
// kb does not hold, and unqualified bylaw numbers are reported for a person to read, never guessed:
// see tools/lib/cites.ts. Re-running is safe, and the output format matches tools/import-bclaws.ts,
// so an import after this leaves the items alone.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_ROOT, loadItems, type RawItem } from './lib/kb.ts';
import { findReferences, replaceCitesLine, resolveReferences, type Scope, type Unresolved } from './lib/cites.ts';

const write = process.argv.includes('--write');
const details = process.argv.includes('--details');

/** The document an item belongs to, from its id. Items that are not statute sections are skipped. */
function scopeOf(id: string): Scope | null {
  if (id.startsWith('bc.spa.sched.bylaw')) return 'sched';
  if (id.startsWith('bc.spa.s')) return 'spa';
  if (id.startsWith('bc.spr.s')) return 'spr';
  return null;
}

type Change = { item: RawItem; before: string[]; after: string[] };

const { items, issues } = loadItems();
for (const issue of issues) console.error(`${issue.path}: ${issue.message}`);

const ids = new Set(items.map((i) => String(i.frontmatter.id)));
const changes: Change[] = [];
const unresolved: { path: string; entry: Unresolved }[] = [];
let scanned = 0;

for (const item of items) {
  const id = String(item.frontmatter.id);
  const scope = scopeOf(id);
  if (!scope) continue;
  scanned++;
  const refs = findReferences(item.body, scope);
  const result = resolveReferences(refs, { ids, selfId: id });
  for (const entry of result.unresolved) unresolved.push({ path: item.path, entry });
  const before = Array.isArray(item.frontmatter.cites) ? (item.frontmatter.cites as string[]) : [];
  if (before.join('|') !== result.cites.join('|')) changes.push({ item, before, after: result.cites });
}

// ---------------------------------------------------------------------------
// Report

for (const { item, before, after } of changes) {
  const added = after.filter((c) => !before.includes(c));
  const removed = before.filter((c) => !after.includes(c));
  const parts = [added.length ? `+ ${added.join(', ')}` : '', removed.length ? `- ${removed.join(', ')}` : ''];
  console.log(`${item.path}\n  ${parts.filter(Boolean).join('\n  ')}`);
}

const byReason = new Map<Unresolved['reason'], typeof unresolved>();
for (const u of unresolved) byReason.set(u.entry.reason, [...(byReason.get(u.entry.reason) ?? []), u]);

console.log('');
console.log(`${scanned} statute item(s) scanned; ${changes.length} would change${write ? ' (written)' : ''}.`);
const citeCount = changes.reduce((n, c) => n + c.after.length, 0);
console.log(`${citeCount} cite(s) in the changed items.`);

for (const reason of ['other-act', 'part', 'not-in-kb', 'unqualified-bylaw'] as const) {
  const list = byReason.get(reason) ?? [];
  if (list.length === 0) continue;
  const targets = new Map<string, number>();
  for (const u of list) targets.set(u.entry.target, (targets.get(u.entry.target) ?? 0) + 1);
  const sorted = [...targets.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  console.log(`\nnot cited — ${reason} (${list.length} reference(s), ${targets.size} distinct):`);
  for (const [target, n] of sorted) console.log(`  ${target}${n > 1 ? ` (${n})` : ''}`);
  if (details) for (const u of list) console.log(`    ${u.path}: "${u.entry.raw}"`);
}

if (write) {
  for (const { item, after } of changes) {
    const full = join(KB_ROOT, item.path);
    writeFileSync(full, replaceCitesLine(readFileSync(full, 'utf8'), after));
  }
}
