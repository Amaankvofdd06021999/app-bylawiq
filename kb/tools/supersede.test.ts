import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setFrontmatterField } from './lib/frontmatter.ts';
import { archiveItem, changedLines, supersededId, supersededPath } from './lib/supersede.ts';

const item = [
  '---',
  'id: bc.spa.s135',
  'layer: law',
  'type: act-section',
  'title: "Complaint, right to answer and notice of decision"',
  'in_force_from: null',
  'in_force_to: null',
  'cites: [bc.spa.s34.1]',
  'status: reviewed',
  'reviewed_by: "J. Researcher, legal researcher"',
  'notes: "Imported verbatim from the consolidation current to 2026-09-22."',
  '---',
  '',
  '# Section 135 — Complaint, right to answer and notice of decision',
  '',
  'The strata corporation must not impose a fine.',
  '',
].join('\n');

// ---------------------------------------------------------------------------
// setFrontmatterField

test('replaces a frontmatter field in place', () => {
  const out = setFrontmatterField(item, 'in_force_to', '2026-09-22');
  assert.ok(out.includes('in_force_to: 2026-09-22'));
  assert.ok(out.includes('in_force_from: null'), 'leaves the neighbouring field alone');
});

test('does not touch a line in the body that looks like a field', () => {
  const body = ['---', 'id: x.y', 'notes: null', '---', '', 'id: not a field down here.', ''].join('\n');
  const out = setFrontmatterField(body, 'id', 'x.z');
  assert.ok(out.endsWith('id: not a field down here.\n'));
  assert.ok(out.includes('id: x.z'));
});

test('refuses a file with no frontmatter rather than corrupting it', () => {
  assert.throws(() => setFrontmatterField('# Section 135\n', 'id', 'x'), /frontmatter/);
});

test('refuses a field the frontmatter does not have', () => {
  assert.throws(() => setFrontmatterField(item, 'supersedes', 'x'), /supersedes/);
});

// ---------------------------------------------------------------------------
// ids and paths for an archived version

test('builds an archived id from the item id and the date the change was seen', () => {
  assert.equal(supersededId('bc.spa.s135', '2026-09-22'), 'bc.spa.s135.2026-09-22');
});

test('keeps an archived id inside the schema id pattern', () => {
  const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
  assert.ok(pattern.test(supersededId('bc.spa.sched.bylaw3', '2027-01-01')));
  assert.ok(pattern.test(supersededId('bc.spr.s6.4', '2027-01-01')));
});

test('files an archived version under superseded/, out of the Part folders', () => {
  assert.equal(
    supersededPath('law/bc/acts/strata-property-act', 'law/bc/acts/strata-property-act/part-07/s135.md', '2026-09-22'),
    'law/bc/acts/strata-property-act/superseded/s135.2026-09-22.md',
  );
});

// ---------------------------------------------------------------------------
// archiveItem

test('sets in_force_to on the archived version so it stops answering questions about today', () => {
  const out = archiveItem(item, { id: 'bc.spa.s135.2026-09-22', inForceTo: '2026-09-22' });
  assert.ok(out.includes('in_force_to: 2026-09-22'));
});

test('gives the archived version its own id, leaving the stable id with the current text', () => {
  const out = archiveItem(item, { id: 'bc.spa.s135.2026-09-22', inForceTo: '2026-09-22' });
  assert.ok(out.includes('id: bc.spa.s135.2026-09-22'));
  assert.ok(!out.includes('id: bc.spa.s135\n'));
});

test('keeps the review sign-off, because the review was of this text', () => {
  const out = archiveItem(item, { id: 'bc.spa.s135.2026-09-22', inForceTo: '2026-09-22' });
  assert.ok(out.includes('status: reviewed'));
  assert.ok(out.includes('reviewed_by: "J. Researcher, legal researcher"'));
});

test('says in notes that the end date is when the change was seen, not a statutory date', () => {
  const out = archiveItem(item, { id: 'bc.spa.s135.2026-09-22', inForceTo: '2026-09-22' });
  assert.match(out, /in_force_to is the consolidation date on which this text was found to have changed/);
  assert.ok(out.includes('Imported verbatim from the consolidation current to 2026-09-22.'),
    'keeps the original notes');
});

test('leaves the body untouched', () => {
  const out = archiveItem(item, { id: 'bc.spa.s135.2026-09-22', inForceTo: '2026-09-22' });
  assert.ok(out.endsWith('The strata corporation must not impose a fine.\n'));
});

// ---------------------------------------------------------------------------
// changedLines: what to show a reviewer

test('reports the lines that went and the lines that arrived', () => {
  const out = changedLines('a\nb\nc\n', 'a\nB\nc\n');
  assert.deepEqual(out, ['- b', '+ B']);
});

test('reports nothing when the text is the same', () => {
  assert.deepEqual(changedLines('a\nb\n', 'a\nb\n'), []);
});

test('caps the report so one rewritten section cannot bury the others', () => {
  const before = Array.from({ length: 40 }, (_, i) => `old ${i}`).join('\n');
  const after = Array.from({ length: 40 }, (_, i) => `new ${i}`).join('\n');
  const out = changedLines(before, after, 6);
  assert.equal(out.length, 7);
  assert.match(out[6], /74 more changed line/);
});
