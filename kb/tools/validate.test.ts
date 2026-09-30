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
