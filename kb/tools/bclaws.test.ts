import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, textContent } from './lib/xml.ts';
import { parseBclawsDocument, parseCurrentTo, type ParseOptions } from './lib/bclaws.ts';

const NS = 'xmlns:act="a" xmlns:bcl="b" xmlns:in="i" xmlns:oasis="o"';
const opts: ParseOptions = { defaultContentId: 'doc_00', convertSchedules: true, scheduleSectionLabel: 'Standard Bylaws, section' };

function parse(inner: string, o: ParseOptions = opts) {
  return parseBclawsDocument(parseXml(`<?xml version="1.0"?><!-- licence --><act:act ${NS}><act:title>T</act:title>${inner}</act:act>`), o);
}

test('xml parser reads elements, attributes, entities and rejects malformed input', () => {
  const root = parseXml('<a x="1 &amp; 2"><b>caf&#233; &lt;ok&gt;</b><c/></a>');
  assert.equal(root.attrs.x, '1 & 2');
  assert.equal(textContent(root), 'café <ok>');
  assert.throws(() => parseXml('<a><b></a>'), /mismatched closing tag/);
  assert.throws(() => parseXml('<a>&nbsp;</a>'), /unknown XML entity/);
  assert.throws(() => parseXml('<a>'), /unclosed element/);
});

test('converts a section with subsections, nested paragraphs and sandwich text', () => {
  const doc = parse(`<act:content id="doc_07"><bcl:part><bcl:num>7</bcl:num><bcl:text>Bylaws</bcl:text>
    <bcl:division><bcl:num>3</bcl:num><bcl:text>Enforcing</bcl:text>
    <bcl:section id="s"><bcl:marginalnote>Complaint</bcl:marginalnote><bcl:num>135</bcl:num>
      <bcl:subsection><bcl:num>1</bcl:num><bcl:text>The strata
        corporation must not</bcl:text>
        <bcl:paragraph><bcl:num>a</bcl:num><bcl:text>impose a fine,</bcl:text></bcl:paragraph>
        <bcl:text>for a contravention unless it has</bcl:text>
        <bcl:paragraph><bcl:num>d</bcl:num><bcl:text>received</bcl:text>
          <bcl:subparagraph><bcl:num>i</bcl:num><bcl:text>a complaint under the <bcl:link><in:doc>Land Title Act</in:doc></bcl:link>,</bcl:text></bcl:subparagraph>
        </bcl:paragraph>
      </bcl:subsection>
      <bcl:subsection><bcl:num>2</bcl:num><bcl:text>In this section, <in:term>hearing</in:term> means$1 000.</bcl:text></bcl:subsection>
    </bcl:section></bcl:division></bcl:part></act:content>`);
  assert.equal(doc.sections.length, 1);
  const s = doc.sections[0];
  assert.equal(s.num, '135');
  assert.equal(s.contentId, 'doc_07');
  assert.deepEqual(s.part, { num: '7', title: 'Bylaws' });
  assert.deepEqual(s.division, { num: '3', title: 'Enforcing' });
  assert.equal(
    s.body,
    [
      '# Section 135 — Complaint',
      '## (1)',
      'The strata corporation must not',
      '- (a) impose a fine,',
      'for a contravention unless it has',
      '- (d) received\n  - (i) a complaint under the *Land Title Act*,',
      '## (2)',
      'In this section, **"hearing"** means$1 000.',
    ].join('\n\n') + '\n',
  );
});

test('skips repealed and spent sections and records them', () => {
  const doc = parse(`<bcl:part><bcl:num>8</bcl:num><bcl:text>Rentals</bcl:text>
    <bcl:section><bcl:marginalnote>Repealed</bcl:marginalnote><bcl:num>139-140</bcl:num><bcl:text>[Repealed 2022-41-17.]</bcl:text></bcl:section>
    <bcl:section><bcl:marginalnote>No restriction</bcl:marginalnote><bcl:num>141</bcl:num><bcl:text>Text.</bcl:text></bcl:section>
  </bcl:part>`);
  assert.deepEqual(doc.sections.map((s) => s.num), ['141']);
  assert.deepEqual(doc.omitted.map((o) => [o.num, o.text]), [['139-140', '[Repealed 2022-41-17.]']]);
});

test('reads Schedule of Standard Bylaws divisions, or skips schedules when asked', () => {
  const xml = `<bcl:schedule><bcl:scheduletitle>Schedule of Standard Bylaws</bcl:scheduletitle>
    <bcl:centertext><in:strong>Division 1 — Duties of Owners</in:strong></bcl:centertext>
    <bcl:section><bcl:marginalnote>Payment of strata fees</bcl:marginalnote><bcl:num>1</bcl:num><bcl:text>An owner must pay.</bcl:text></bcl:section>
  </bcl:schedule>`;
  const doc = parse(xml);
  assert.equal(doc.sections[0].schedule, true);
  assert.deepEqual(doc.sections[0].division, { num: '1', title: 'Duties of Owners' });
  assert.match(doc.sections[0].body, /^# Standard Bylaws, section 1 — Payment of strata fees\n\nAn owner must pay\.\n$/);
  const skipped = parse(xml, { ...opts, convertSchedules: false });
  assert.equal(skipped.sections.length, 0);
  assert.deepEqual(skipped.skippedSchedules, ['Schedule of Standard Bylaws']);
});

test('formulas: images become links, text tables become a fenced layout', () => {
  const doc = parse(`<bcl:part><bcl:num>6</bcl:num><bcl:text>Finances</bcl:text>
    <bcl:section><bcl:marginalnote>Fees</bcl:marginalnote><bcl:num>99</bcl:num>
      <bcl:text>calculated as follows:</bcl:text>
      <oasis:table><oasis:tgroup cols="1"><oasis:tbody><oasis:trow><oasis:entry><oasis:line><in:graphic href="/document/ID/statreg/x_99.gif"/></oasis:line></oasis:entry></oasis:trow></oasis:tbody></oasis:tgroup></oasis:table>
    </bcl:section>
    <bcl:section><bcl:marginalnote>Formula</bcl:marginalnote><bcl:num>6.4</bcl:num>
      <bcl:text>formula:</bcl:text>
      <oasis:table><oasis:tgroup cols="2"><oasis:tbody><oasis:trow>
        <oasis:entry valign="center"><oasis:line>a<in:hr/>b c</oasis:line></oasis:entry>
        <oasis:entry valign="top"><oasis:line><in:br/>× d</oasis:line></oasis:entry>
      </oasis:trow></oasis:tbody></oasis:tgroup></oasis:table>
    </bcl:section></bcl:part>`);
  assert.equal(doc.sections[0].hasImageFormula, true);
  assert.match(doc.sections[0].body, /!\[formula\]\(https:\/\/www\.bclaws\.gov\.bc\.ca\/civix\/document\/id\/complete\/statreg\/x_99\.gif\)/);
  assert.equal(doc.sections[1].hasTextFormula, true);
  assert.match(doc.sections[1].body, /```text\n {0,2}a\n---  × d\nb c\n```/);
});

test('unknown markup stops the import', () => {
  assert.throws(() => parse('<bcl:part><bcl:num>1</bcl:num><bcl:section><bcl:marginalnote>X</bcl:marginalnote><bcl:num>1</bcl:num><bcl:text><in:mystery>t</in:mystery></bcl:text></bcl:section></bcl:part>'), /unsupported inline element <in:mystery>/);
  assert.throws(() => parse('<bcl:part><bcl:num>1</bcl:num><bcl:section><bcl:marginalnote>X</bcl:marginalnote><bcl:num>1</bcl:num><bcl:weird/></bcl:section></bcl:part>'), /unsupported element <bcl:weird>/);
});

test('reads the "current to" date', () => {
  assert.equal(parseCurrentTo('<td>This Act is current to September 22, 2026</td>'), '2026-09-22');
  assert.throws(() => parseCurrentTo('<p>nothing</p>'), /could not find/);
});
