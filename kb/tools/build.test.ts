import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkBody, splitSections } from './lib/chunk.ts';

test('chunking splits on headings and records the heading path', () => {
  const body = [
    'Intro text before any heading.',
    '',
    '# Part 7',
    '',
    '## Section 135',
    '',
    'First paragraph.',
    '',
    '### (1)',
    '',
    'Subsection text.',
    '',
    '## Section 136',
    '',
    'Another section.',
  ].join('\n');
  const chunks = chunkBody('bc.spa.test', body);
  assert.deepEqual(chunks.map((c) => c.heading), [null, 'Section 135', '(1)', 'Section 136']);
  assert.deepEqual(chunks.map((c) => c.section_ref), [null, 'Part 7 > Section 135', 'Part 7 > Section 135 > (1)', 'Part 7 > Section 136']);
  assert.deepEqual(chunks.map((c) => c.content), ['Intro text before any heading.', 'First paragraph.', 'Subsection text.', 'Another section.']);
  assert.deepEqual(chunks.map((c) => c.chunk_id), ['bc.spa.test#001', 'bc.spa.test#002', 'bc.spa.test#003', 'bc.spa.test#004']);
});

test('long sections split on paragraphs and stay under the limit', () => {
  const para = (n: number) => `Paragraph ${n}. ` + 'word '.repeat(90).trim() + '.';
  const body = '## Long section\n\n' + Array.from({ length: 6 }, (_, i) => para(i)).join('\n\n');
  const chunks = chunkBody('x', body, 1200);
  assert.ok(chunks.length > 1);
  for (const c of chunks) {
    assert.ok(c.content.length <= 1200, `chunk is ${c.content.length} chars`);
    assert.equal(c.heading, 'Long section');
    assert.ok(c.content.startsWith('Paragraph'), 'chunks break at paragraph boundaries');
  }
});

test('a paragraph longer than the limit is split on sentences', () => {
  const body = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
  const chunks = chunkBody('x', body, 200);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.content.length <= 200);
  assert.equal(chunks.map((c) => c.content).join(' ').replace(/\s+/g, ' '), body);
});

test('headings inside code fences are not treated as sections', () => {
  const sections = splitSections('## Real\n\n```\n# not a heading\n```\n');
  assert.equal(sections.length, 1);
  assert.equal(sections[0].heading, 'Real');
});
