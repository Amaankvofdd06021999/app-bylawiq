import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContext, parseItem, parseLicenceIds, validateItems, validateSourceFile, type RawItem, type Context } from './lib/kb.ts';

const ctx: Context = loadContext();

function item(path: string, overrides: Record<string, unknown> = {}): RawItem {
  return {
    path,
    body: '# Heading\n\nSome content.\n',
    frontmatter: {
      id: 'test.item',
      layer: 'topic',
      type: 'topic-guide',
      title: 'Test item',
      citation: null,
      jurisdiction: 'BC',
      source_url: null,
      in_force_from: null,
      in_force_to: null,
      retrieved_at: null,
      licence: 'bylawiq-original',
      topics: ['pets'],
      cites: [],
      supersedes: null,
      status: 'draft',
      reviewed_by: null,
      reviewed_at: null,
      notes: null,
      ...overrides,
    },
  };
}

function lawItem(overrides: Record<string, unknown> = {}): RawItem {
  return item('law/bc/acts/strata-property-act/s135.md', {
    id: 'bc.spa.s135',
    layer: 'law',
    type: 'act-section',
    title: 'Test section',
    citation: 'Test citation',
    source_url: 'https://example.org/source',
    in_force_from: '2000-07-01',
    retrieved_at: '2026-01-01',
    licence: 'bc-kings-printer',
    ...overrides,
  });
}

const errors = (items: RawItem[]) => validateItems(items, ctx).filter((i) => i.level === 'error').map((i) => i.message);

test('a valid item has no errors', () => {
  assert.deepEqual(errors([item('topics/test.md')]), []);
  assert.deepEqual(errors([lawItem()]), []);
});

test('rejects a topic that is not in the taxonomy', () => {
  const errs = errors([item('topics/test.md', { topics: ['pets', 'not-a-topic'] })]);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /topic not-a-topic is not in taxonomy/);
});

test('rejects a cite that does not resolve', () => {
  const errs = errors([item('topics/test.md', { cites: ['bc.spa.s999'] })]);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /cites bc\.spa\.s999, which is not a kb item/);
});

test('accepts a cite that resolves to another item', () => {
  assert.deepEqual(errors([lawItem(), item('topics/test.md', { cites: ['bc.spa.s135'] })]), []);
});

test('rejects a law item with no licence', () => {
  const missing = lawItem();
  delete missing.frontmatter.licence;
  assert.ok(errors([missing]).some((m) => /law items must have a licence/.test(m)));
  assert.ok(errors([lawItem({ licence: '' })]).some((m) => /law items must have a licence/.test(m)));
});

test('rejects a licence that is not in the licensing register', () => {
  assert.ok(errors([lawItem({ licence: 'made-up' })]).some((m) => /licence made-up is not listed/.test(m)));
});

test('rejects a law item without source_url or retrieved_at', () => {
  const errs = errors([lawItem({ source_url: null, retrieved_at: null })]);
  assert.ok(errs.includes('law items must have source_url'));
  assert.ok(errs.includes('law items must have retrieved_at'));
});

test('rejects an approved item without reviewer sign-off', () => {
  const errs = errors([item('topics/test.md', { status: 'approved' })]);
  assert.ok(errs.includes('status approved requires reviewed_by'));
  assert.ok(errs.includes('status approved requires reviewed_at'));
  assert.deepEqual(
    errors([item('topics/test.md', { status: 'approved', reviewed_by: 'A. Reviewer, counsel', reviewed_at: '2026-01-02' })]),
    [],
  );
});

test('rejects duplicate ids, bad dates, unknown fields and wrong folders', () => {
  const errs = errors([
    item('topics/a.md'),
    item('topics/b.md', { in_force_from: '2026-02-30', extra: true }),
    item('firm-starter/templates/c.md', { id: 'other' }),
  ]);
  assert.ok(errs.some((m) => /duplicate id test\.item/.test(m)));
  assert.ok(errs.some((m) => /in_force_from "2026-02-30" is not a valid/.test(m)));
  assert.ok(errs.some((m) => /unknown field extra/.test(m)));
  assert.ok(errs.some((m) => /layer topic items must live under/.test(m)));
});

test('rejects a type that does not belong to the layer', () => {
  assert.ok(errors([item('topics/test.md', { type: 'crt-decision' })]).some((m) => /not allowed in layer topic/.test(m)));
});

test('parses frontmatter and body', () => {
  const parsed = parseItem('---\nid: a.b\nin_force_from: 2026-01-01\n---\n\n# Body\n', 'x.md');
  assert.equal(parsed.frontmatter.id, 'a.b');
  assert.equal(parsed.frontmatter.in_force_from, '2026-01-01', 'unquoted dates stay strings');
  assert.equal(parsed.body, '# Body\n');
  assert.throws(() => parseItem('# no frontmatter', 'x.md'), /missing YAML frontmatter/);
});

test('reads licence ids from the register table', () => {
  const ids = parseLicenceIds('| Licence id | Terms |\n|---|---|\n| `bc-kings-printer` | x |\n| `canlii` | y |\n');
  assert.deepEqual([...ids], ['bc-kings-printer', 'canlii']);
});

test('source.json needs dates once the folder holds items', () => {
  const src = { title: 'T', citation: 'C', chapter: '1', url: 'https://example.org', consolidation_date: null, licence: 'bc-kings-printer', retrieved_at: null, parts: [] };
  assert.equal(validateSourceFile(src, 'x/source.json', false, ctx).length, 0);
  assert.equal(validateSourceFile(src, 'x/source.json', true, ctx).length, 2);
});

function decisionItem(type: 'crt-decision' | 'court-decision', body: string, overrides: Record<string, unknown> = {}): RawItem {
  const d = item(`law/bc/decisions/${type === 'crt-decision' ? 'crt' : 'courts'}/x.md`, {
    id: 'bc.crt.2024-bccrt-1',
    layer: 'law',
    type,
    title: '2024 BCCRT 1',
    citation: '2024 BCCRT 1',
    source_url: 'https://decisions.civilresolutionbc.ca/crt/en/nav.do',
    in_force_from: '2024-01-02',
    retrieved_at: '2026-01-01',
    licence: type === 'crt-decision' ? 'crt-decisions' : 'court-decisions',
    ...overrides,
  });
  d.body = body;
  return d;
}

const summary = '# 2024 BCCRT 1\n\n## Facts\n\nOur words.\n\n## Issue\n\nOur words.\n\n## Holding\n\nOur words.\n\n## Principle\n\nOur words.\n';

test('decision items need Facts, Issue, Holding and Principle headings in order', () => {
  assert.deepEqual(errors([decisionItem('crt-decision', summary)]), []);
  assert.deepEqual(errors([decisionItem('court-decision', summary, { id: 'bc.bcsc.2016-bcsc-32', title: 'Owners v. Holding', citation: '2016 BCSC 32' })]), []);
  const noPrinciple = summary.replace('## Principle', '## Notes');
  assert.ok(errors([decisionItem('crt-decision', noPrinciple)]).some((m) => /missing or out of order: Principle/.test(m)));
  const swapped = summary.replace('## Issue', '## TMP').replace('## Holding', '## Issue').replace('## TMP', '## Holding');
  assert.ok(errors([decisionItem('crt-decision', swapped)]).some((m) => /headings Facts, Issue, Holding, Principle/.test(m)));
});

test('decision items cannot carry long quotations or a verbatim licence', () => {
  const quoted = summary.replace('Our words.', `> ${'x'.repeat(401)}`);
  assert.ok(errors([decisionItem('crt-decision', quoted)]).some((m) => /quote 401 characters/.test(m)));
  const brief = summary.replace('Our words.', `> ${'x'.repeat(200)}`);
  assert.deepEqual(errors([decisionItem('crt-decision', brief)]), []);
  assert.ok(errors([decisionItem('court-decision', summary, { licence: 'bc-kings-printer' })]).some((m) => /cannot use the bc-kings-printer licence/.test(m)));
});

test('crt-decision items must not name the parties', () => {
  const errs = errors([decisionItem('crt-decision', summary, { title: 'Smith v. The Owners, Strata Plan VR 1', citation: 'Smith v. The Owners, Strata Plan VR 1, 2024 BCCRT 1' })]);
  assert.equal(errs.filter((m) => /must not name the parties/.test(m)).length, 2);
});
