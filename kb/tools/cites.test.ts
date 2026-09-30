import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareSectionNumbers, findReferences, replaceCitesLine, resolveReferences } from './lib/cites.ts';

// ---------------------------------------------------------------------------
// findReferences: which sections a body of statute text points at

test('finds a single section reference in an Act item', () => {
  const refs = findReferences('The strata corporation must comply with section 135.', 'spa');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['spa', ['135']]]);
});

test('ignores the subsection and paragraph parts of a reference', () => {
  const refs = findReferences('An amount described in section 149 (1) (d) is owing.', 'spa');
  assert.deepEqual(refs[0].numbers, ['149']);
});

test('reads a decimal section number', () => {
  const refs = findReferences('A hearing under section 34.1 must be held.', 'spa');
  assert.deepEqual(refs[0].numbers, ['34.1']);
});

test('reads a list of sections joined by "and"', () => {
  const refs = findReferences('sections 244 and 245, and the registrar must act.', 'spa');
  assert.deepEqual(refs[0].numbers, ['244', '245']);
});

test('reads a list of sections joined by "or", each with a subsection', () => {
  const refs = findReferences('a levy under section 99 (2) or 100 (1) except that', 'spa');
  assert.deepEqual(refs[0].numbers, ['99', '100']);
});

test('reads a comma-separated list of sections', () => {
  const refs = findReferences('sections 224, 225 and 243 apply.', 'spa');
  assert.deepEqual(refs[0].numbers, ['224', '225', '243']);
});

test('records a "to" range as a range, not as two sections', () => {
  const refs = findReferences('sections 112 to 118 apply.', 'spa');
  assert.deepEqual(refs[0].numbers, []);
  assert.deepEqual(refs[0].ranges, [{ from: '112', to: '118' }]);
});

test('keeps reading a list across a bare subsection', () => {
  const refs = findReferences('sections 14 (4) and (5) and 17 (b) are money owing.', 'spa');
  assert.deepEqual(refs[0].numbers, ['14', '17']);
});

test('does not treat "subsection" as a section reference', () => {
  assert.deepEqual(findReferences('the persons referred to in subsection (1) (e) and (f).', 'spa'), []);
});

test('ignores heading lines, so an item does not cite itself', () => {
  const refs = findReferences('# Section 135 — Complaint\n\n## (1)\n\nThe strata corporation must not\n', 'spa');
  assert.deepEqual(refs, []);
});

test('reads "of the Act" in a regulation item as the Strata Property Act', () => {
  const refs = findReferences('A budget under section 103 of the Act must be approved.', 'spr');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['spa', ['103']]]);
});

test('reads a bare reference in a regulation item as the regulation itself', () => {
  const refs = findReferences('The formula in section 6.4 applies.', 'spr');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['spr', ['6.4']]]);
});

test('reads "of this Act" in an Act item as the Act itself', () => {
  const refs = findReferences('sections 87 to 90 of this Act, the owner developer must', 'spa');
  assert.equal(refs[0].doc, 'spa');
});

test('reads "of this regulation" as the regulation', () => {
  const refs = findReferences('section 4.1 of this regulation applies.', 'spr');
  assert.equal(refs[0].doc, 'spr');
});

test('reads "of the Act" in a standard bylaw as the Strata Property Act', () => {
  const refs = findReferences('a hearing under section 135 of the Act;', 'sched');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['spa', ['135']]]);
});

test('marks an italicised other Act as external', () => {
  const refs = findReferences('section 6 of the *Condominium Act* continues to apply.', 'spa');
  assert.equal(refs[0].doc, 'external');
  assert.equal(refs[0].external, 'Condominium Act');
});

test('marks a named regulation of another scheme as external', () => {
  const refs = findReferences('section 5 of the Electrical Safety Regulation applies.', 'spr');
  assert.equal(refs[0].doc, 'external');
  assert.equal(refs[0].external, 'Electrical Safety Regulation');
});

test('keeps a whole external list external', () => {
  const refs = findReferences('sections 428 to 430 of the *Condominium Act* are repealed.', 'spa');
  assert.equal(refs.length, 1);
  assert.equal(refs[0].doc, 'external');
});

test('records a Part reference, which has no item to cite', () => {
  const refs = findReferences('Part 7 applies to the strata corporation.', 'spa');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['part', ['7']]]);
});

test('records a Division reference, which the kb has no item for either', () => {
  const refs = findReferences('an alteration referred to in Division 6 of Part 5.', 'spa');
  assert.deepEqual(refs.map((r) => [r.doc, r.unit, r.numbers]), [['part', 'Division', ['6']], ['part', 'Part', ['5']]]);
});

test('names the structural unit in the report, so a Division is not read as a Part', () => {
  const refs = findReferences('the provisions in Division 2 apply.', 'spa');
  const { unresolved } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s1' });
  assert.deepEqual(unresolved.map((u) => [u.reason, u.target]), [['part', 'Division 2']]);
});

test('reads a standard bylaw reference in the Schedule', () => {
  const refs = findReferences('despite bylaw 23, the fine is set by the Regulation.', 'sched');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['sched', ['23']]]);
});

test('reads "bylaw 3 of the Standard Bylaws" as a Schedule reference', () => {
  const refs = findReferences('bylaw 3 of the Standard Bylaws is deemed amended.', 'spr');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['sched', ['3']]]);
});

test('leaves an unqualified bylaw number in the Act unresolved, because it may be a strata’s own bylaw', () => {
  const refs = findReferences('a strata corporation that has passed bylaw 4 may', 'spa');
  assert.equal(refs[0].doc, 'unqualified-bylaw');
});

// The four patterns below are real BC Laws drafting habits, each found in an imported item.

test('reads the qualifier past an italicised marginal note (Act, s. 256 (1.1))', () => {
  const refs = findReferences('satisfied under section 168.33 or 168.43 *[supporting documents]* of the *Land Title Act*.', 'spa');
  assert.equal(refs[0].doc, 'external');
  assert.equal(refs[0].external, 'Land Title Act');
});

test('consumes consecutive bare subsections, so the qualifier is still found (Regulation, s. 17.6)', () => {
  const refs = findReferences('The easements referred to in section 69 (1) (b) and (2) (b) of the Act do not apply', 'spr');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['spa', ['69']]]);
});

test('carries a trailing qualifier across a repeated "section" lead (Regulation, s. 3.01)', () => {
  const refs = findReferences('For the purposes of section 12 (2) and (3) (a) and section 13 (2) (b) of the Act, the prescribed percentage is 10%.', 'spr');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['spa', ['12', '13']]]);
});

test('reads a bare whole number in a regulation item as the Act, because every Regulation section is numbered N.M (Regulation, s. 17.23)', () => {
  const refs = findReferences('- (f) section 159 (1) *[general meeting to decide not to repair]*;', 'spr');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['spa', ['159']]]);
});

test('still reads a decimal reference in a regulation item as the regulation', () => {
  const refs = findReferences('as required by section 6.4 (2).', 'spr');
  assert.deepEqual(refs.map((r) => [r.doc, r.numbers]), [['spr', ['6.4']]]);
});

test('leaves a mixed regulation list with the regulation, so the mismatch is reported not guessed', () => {
  const refs = findReferences('sections 6.4 and 12 apply.', 'spr');
  assert.equal(refs[0].doc, 'spr');
});

test('does not merge a Part with a section that follows it (Act, s. 276 (2))', () => {
  const refs = findReferences('Division 10 of Part 10 and section 324 of the *Business Corporations Act* do not apply.', 'spa');
  assert.deepEqual(refs.map((r) => [r.doc, r.unit, r.numbers]), [
    ['part', 'Division', ['10']],
    ['part', 'Part', ['10']],
    ['external', null, ['324']],
  ]);
});

test('does not merge two references that each name their own enactment', () => {
  const refs = findReferences('section 12 of the Act and section 4 (g) of the *Real Estate Services Act* apply.', 'spr');
  assert.deepEqual(refs.map((r) => [r.doc, r.external]), [['spa', null], ['external', 'Real Estate Services Act']]);
});

// ---------------------------------------------------------------------------
// compareSectionNumbers: BC Laws inserts 5.101 between 5.1 and 5.11

test('orders whole section numbers numerically, not as strings', () => {
  assert.ok(compareSectionNumbers('9', '100') < 0);
});

test('orders a decimal section after the whole section it follows', () => {
  assert.ok(compareSectionNumbers('34', '34.1') < 0);
});

test('orders inserted decimal sections the way BC Laws numbers them', () => {
  const sorted = ['5.2', '5.11', '5.1', '5.101', '6'].sort(compareSectionNumbers);
  assert.deepEqual(sorted, ['5.1', '5.101', '5.11', '5.2', '6']);
});

// ---------------------------------------------------------------------------
// resolveReferences: references to kb item ids

const spaIds = new Set(['bc.spa.s112', 'bc.spa.s113', 'bc.spa.s118', 'bc.spa.s135', 'bc.spa.s34.1']);

test('resolves a section reference to a kb item id', () => {
  const refs = findReferences('see section 135.', 'spa');
  const { cites } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s1' });
  assert.deepEqual(cites, ['bc.spa.s135']);
});

test('expands a range over the sections that exist in the kb', () => {
  const refs = findReferences('sections 112 to 118 apply.', 'spa');
  const { cites } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s1' });
  assert.deepEqual(cites, ['bc.spa.s112', 'bc.spa.s113', 'bc.spa.s118']);
});

test('never lets an item cite itself', () => {
  const refs = findReferences('nothing in section 135 limits this.', 'spa');
  const { cites } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s135' });
  assert.deepEqual(cites, []);
});

test('reports a section that is not in the kb instead of citing it', () => {
  const refs = findReferences('see section 142.', 'spa');
  const { cites, unresolved } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s1' });
  assert.deepEqual(cites, []);
  assert.deepEqual(unresolved.map((u) => [u.reason, u.target]), [['not-in-kb', 'bc.spa.s142']]);
});

test('reports an external Act reference with the Act named', () => {
  const refs = findReferences('section 6 of the *Land Title Act* applies.', 'spa');
  const { cites, unresolved } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s1' });
  assert.deepEqual(cites, []);
  assert.deepEqual(unresolved.map((u) => [u.reason, u.target]), [['other-act', 'Land Title Act']]);
});

test('reports a Part reference, which the kb has no item for', () => {
  const refs = findReferences('Part 7 applies.', 'spa');
  const { unresolved } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s1' });
  assert.deepEqual(unresolved.map((u) => [u.reason, u.target]), [['part', 'Part 7']]);
});

test('reports a range that covers no kb section instead of citing nothing silently', () => {
  const refs = findReferences('sections 142 to 145 apply.', 'spa');
  const { cites, unresolved } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s1' });
  assert.deepEqual(cites, []);
  assert.deepEqual(unresolved.map((u) => u.reason), ['not-in-kb']);
});

test('reports an unqualified bylaw number for a person to check', () => {
  const refs = findReferences('a strata corporation that has passed bylaw 4 may', 'spa');
  const { cites, unresolved } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s1' });
  assert.deepEqual(cites, []);
  assert.deepEqual(unresolved.map((u) => u.reason), ['unqualified-bylaw']);
});

test('returns each cited id once, in kb order', () => {
  const refs = findReferences('section 135 and section 112, and again section 135.', 'spa');
  const { cites } = resolveReferences(refs, { ids: spaIds, selfId: 'bc.spa.s1' });
  assert.deepEqual(cites, ['bc.spa.s112', 'bc.spa.s135']);
});

// ---------------------------------------------------------------------------
// replaceCitesLine: writing cites back without disturbing the rest of the file

const file = [
  '---',
  'id: bc.spa.s135',
  'topics: [fines, hearings]',
  'cites: []',
  'notes: "Imported verbatim: see section 135."',
  '---',
  '',
  '# Section 135',
  '',
  'cites: not a field down here.',
  '',
].join('\n');

test('writes the cites list in the same flow style the importer uses', () => {
  const out = replaceCitesLine(file, ['bc.spa.s34.1', 'bc.spa.s135']);
  assert.ok(out.includes('cites: [bc.spa.s34.1, bc.spa.s135]'));
});

test('leaves every other frontmatter field and the body untouched', () => {
  const out = replaceCitesLine(file, ['bc.spa.s135']);
  assert.equal(out, file.replace('cites: []', 'cites: [bc.spa.s135]'));
});

test('writes an empty list as the importer does', () => {
  assert.ok(replaceCitesLine(file, []).includes('cites: []'));
});

test('refuses a file with no frontmatter rather than corrupting it', () => {
  assert.throws(() => replaceCitesLine('# Section 135\n\ncites: []\n', []), /frontmatter/);
});
