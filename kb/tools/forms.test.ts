import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from './lib/xml.ts';
import { parseForms } from './lib/forms.ts';

const doc = (body: string) => parseXml(
  `<reg:regulation xmlns:reg="r" xmlns:bcl="b" xmlns:in="i" xmlns:oasis="o">${body}</reg:regulation>`,
);

const formK = doc(`
 <bcl:schedule>
  <bcl:scheduletitle>Form K</bcl:scheduletitle>
  <bcl:schedulesubtitle>NOTICE OF TENANT'S RESPONSIBILITIES</bcl:schedulesubtitle>
  <bcl:centertext><in:em>(Section 146)</in:em></bcl:centertext>
  <bcl:lefttext>Re: Strata Lot ....... <in:em>[strata lot number]</in:em></bcl:lefttext>
  <bcl:centertext>The Owners, Strata Plan .......</bcl:centertext>
  <bcl:indent1>I acknowledge that I have received a copy of the bylaws.</bcl:indent1>
 </bcl:schedule>`);

test('finds each form schedule', () => {
  assert.equal(parseForms(formK).length, 1);
});

test('reads the form letter from the schedule title', () => {
  assert.equal(parseForms(formK)[0].num, 'K');
});

test('reads the form name from the subtitle, without the section reference', () => {
  const f = parseForms(formK)[0];
  assert.equal(f.title, "Notice of Tenant's Responsibilities");
});

test('records which section of the Act the form is prescribed for', () => {
  assert.equal(parseForms(formK)[0].reference, 'Section 146');
});

test('keeps a reference to several sections whole, rather than picking one', () => {
  // Form E is prescribed for fourteen sections across both the Act and the Regulation.
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form E</bcl:scheduletitle>
    <bcl:schedulesubtitle>CERTIFICATE OF STRATA CORPORATION</bcl:schedulesubtitle>
    <bcl:centertext><in:em>(Sections 78, 79 of the Act and sections 17.20 to 17.22 of the Regulation)</in:em></bcl:centertext>
   </bcl:schedule>`))[0];
  assert.equal(f.reference, 'Sections 78, 79 of the Act and sections 17.20 to 17.22 of the Regulation');
});

test('does not mistake a parenthesised aside for a section reference', () => {
  // Form A prints "(OPTIONAL FORM)" above its section reference.
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form A</bcl:scheduletitle>
    <bcl:schedulesubtitle>PROXY APPOINTMENT</bcl:schedulesubtitle>
    <bcl:centertext><in:strong>(OPTIONAL FORM)</in:strong></bcl:centertext>
    <bcl:centertext><in:em>(Section 56)</in:em></bcl:centertext>
   </bcl:schedule>`))[0];
  assert.equal(f.reference, 'Section 56');
});

test('marks a repealed form as repealed, so it is not offered as a live form', () => {
  // Form J was repealed by B.C. Reg. 6/2023 and still occupies its letter in the Schedule.
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form J</bcl:scheduletitle>
    <bcl:centertext>Repealed. [B.C. Reg. 6/2023, s. 7.]</bcl:centertext>
   </bcl:schedule>`))[0];
  assert.equal(f.repealed, true);
  assert.match(f.history ?? '', /6\/2023/);
});

test('treats a form that is still in force as not repealed', () => {
  assert.equal(parseForms(formK)[0].repealed, false);
});

test('keeps the words of the form exactly, in document order', () => {
  const body = parseForms(formK)[0].body;
  assert.ok(body.includes('Re: Strata Lot ....... *[strata lot number]*'));
  assert.ok(body.includes('The Owners, Strata Plan .......'));
  assert.ok(body.indexOf('Re: Strata Lot') < body.indexOf('The Owners'), 'preserves order');
  assert.ok(body.includes('I acknowledge that I have received a copy of the bylaws.'));
});

test('handles a form with no subtitle', () => {
  const f = parseForms(doc(`
   <bcl:schedule>
    <bcl:scheduletitle>Form A</bcl:scheduletitle>
    <bcl:lefttext>Some text.</bcl:lefttext>
   </bcl:schedule>`))[0];
  assert.equal(f.num, 'A');
  assert.equal(f.title, null);
  assert.equal(f.reference, null);
});

test('reads a decimal form letter', () => {
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form Z.1</bcl:scheduletitle>
   <bcl:lefttext>x</bcl:lefttext></bcl:schedule>`))[0];
  assert.equal(f.num, 'Z.1');
});

test('keeps the amendment history that follows the form letter', () => {
  const f = parseForms(doc(`
   <bcl:schedule>
    <bcl:scheduletitle>Form B</bcl:scheduletitle>
    <bcl:centertext>[am. B.C. Reg. 6/2023, s. 6.]</bcl:centertext>
    <bcl:schedulesubtitle>INFORMATION CERTIFICATE</bcl:schedulesubtitle>
    <bcl:centertext><in:em>(Section 59)</in:em></bcl:centertext>
    <bcl:lefttext>x</bcl:lefttext>
   </bcl:schedule>`))[0];
  assert.equal(f.num, 'B');
  assert.equal(f.title, 'Information Certificate');
  assert.equal(f.reference, 'Section 59');
  assert.match(f.history ?? '', /am\. B\.C\. Reg\. 6\/2023/);
});

test('flattens a table into one line per row, cells separated', () => {
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form C</bcl:scheduletitle>
    <oasis:table><oasis:tgroup><oasis:tbody>
     <oasis:trow><oasis:entry>Item</oasis:entry><oasis:entry>Amount</oasis:entry></oasis:trow>
     <oasis:trow><oasis:entry>Strata fees</oasis:entry><oasis:entry>$100</oasis:entry></oasis:trow>
    </oasis:tbody></oasis:tgroup></oasis:table>
   </bcl:schedule>`))[0];
  assert.ok(f.body.includes('Item | Amount'), f.body);
  assert.ok(f.body.includes('Strata fees | $100'), f.body);
});

test('drops cells that are empty so a blank column does not add separators', () => {
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form D</bcl:scheduletitle>
    <oasis:table><oasis:tgroup><oasis:tbody>
     <oasis:trow><oasis:entry>Name</oasis:entry><oasis:entry> </oasis:entry><oasis:entry>Date</oasis:entry></oasis:trow>
    </oasis:tbody></oasis:tgroup></oasis:table>
   </bcl:schedule>`))[0];
  assert.ok(f.body.includes('Name | Date'), f.body);
});

test('ignores a schedule that is not a form', () => {
  assert.deepEqual(parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Schedule of Standard Bylaws</bcl:scheduletitle>
   <bcl:lefttext>x</bcl:lefttext></bcl:schedule>`)), []);
});

test('refuses markup it does not recognise rather than dropping words', () => {
  assert.throws(() => parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form E</bcl:scheduletitle>
   <bcl:mystery>text that would vanish</bcl:mystery></bcl:schedule>`)), /bcl:mystery/);
});

test('renders a form checkbox as a text box, not a remote image', () => {
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form F</bcl:scheduletitle>
   <bcl:lefttext><in:graphic height="12" href="/document/ID/statreg/checkbox12.gif" width="12"/> Yes</bcl:lefttext>
   </bcl:schedule>`))[0];
  assert.ok(f.body.includes('[ ] Yes'), f.body);
  assert.ok(!f.body.includes('checkbox12.gif'), 'does not link the image');
});

test('refuses any other graphic, so a logo or diagram cannot slip in silently', () => {
  assert.throws(() => parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form G</bcl:scheduletitle>
   <bcl:lefttext><in:graphic href="/document/ID/statreg/coat-of-arms.gif"/></bcl:lefttext>
   </bcl:schedule>`)), /graphic/);
});

test('renders the three indent levels as text, since form layout is simplified', () => {
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form H</bcl:scheduletitle>
    <bcl:indent1>First level</bcl:indent1>
    <bcl:indent2>Second level</bcl:indent2>
    <bcl:indent3>Third level</bcl:indent3>
   </bcl:schedule>`))[0];
  for (const s of ['First level', 'Second level', 'Third level']) assert.ok(f.body.includes(s), f.body);
});

test('renders a rule between two parts of a form as a rule, not a division', () => {
  // Form E holds five separate certificates and Form V four separate schedules, each divided
  // from the next by a rule on a line of its own.
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form E</bcl:scheduletitle>
    <bcl:lefttext>Signature of Second Council Member</bcl:lefttext>
    <bcl:lefttext><in:hr/></bcl:lefttext>
    <bcl:centertext>CERTIFICATE FOR SECTION 269</bcl:centertext>
   </bcl:schedule>`))[0];
  const lines = f.body.trim().split('\n\n');
  assert.deepEqual(lines, ['Signature of Second Council Member', '---', 'CERTIFICATE FOR SECTION 269']);
});

test('renders a fraction bar as a division, so the formula still reads correctly', () => {
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form I</bcl:scheduletitle>
    <oasis:table><oasis:tgroup><oasis:tbody><oasis:trow><oasis:entry>
      <oasis:line>unit entitlement of strata lot<in:hr/>total unit entitlement</oasis:line>
    </oasis:entry></oasis:trow></oasis:tbody></oasis:tgroup></oasis:table>
   </bcl:schedule>`))[0];
  assert.ok(f.body.includes('unit entitlement of strata lot / total unit entitlement'), f.body);
});

test('renders a superscript digit as a superscript, so m2 reads as square metres', () => {
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form J</bcl:scheduletitle>
    <bcl:lefttext>Habitable Area in m<in:sup>2</in:sup></bcl:lefttext>
   </bcl:schedule>`))[0];
  assert.ok(f.body.includes('Habitable Area in m\u00b2'), f.body);
});

test('lifts a table nested inside a cell into rows of its own', () => {
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form V</bcl:scheduletitle>
    <oasis:table><oasis:tgroup><oasis:tbody><oasis:trow>
     <oasis:entry>Schedule of Unit Entitlement</oasis:entry>
     <oasis:entry><oasis:line>
      <oasis:table><oasis:tgroup><oasis:tbody>
       <oasis:trow><oasis:entry>Strata Lot No.</oasis:entry><oasis:entry>Sheet No.</oasis:entry></oasis:trow>
       <oasis:trow><oasis:entry>1</oasis:entry><oasis:entry>2</oasis:entry></oasis:trow>
      </oasis:tbody></oasis:tgroup></oasis:table>
     </oasis:line></oasis:entry>
    </oasis:trow></oasis:tbody></oasis:tgroup></oasis:table>
   </bcl:schedule>`))[0];
  const lines = f.body.trim().split('\n\n');
  assert.ok(lines.includes('Schedule of Unit Entitlement'), f.body);
  assert.ok(lines.includes('Strata Lot No. | Sheet No.'), f.body);
  assert.ok(lines.includes('1 | 2'), f.body);
});

test('renders a superscript even when it sits inside bold text', () => {
  const f = parseForms(doc(`
   <bcl:schedule><bcl:scheduletitle>Form W</bcl:scheduletitle>
    <bcl:lefttext><in:strong>Total Area in m<in:sup>2</in:sup></in:strong></bcl:lefttext>
   </bcl:schedule>`))[0];
  assert.ok(f.body.includes('Total Area in m\u00b2'), f.body);
});

import { parseFormReference } from './lib/forms.ts';

test('reads a bare section reference as a reference to the Act', () => {
  // The Schedule of Forms is part of the Regulation, but an unqualified "Section 59" in it
  // means section 59 of the Act. The Regulation's own sections are always named as such.
  assert.deepEqual(parseFormReference('Section 59'), { act: ['59'], reg: [] });
});

test('drops the subsection, since an item is one whole section', () => {
  assert.deepEqual(parseFormReference('Section 62 (3)'), { act: ['62'], reg: [] });
  assert.deepEqual(parseFormReference('Section 244 (1) (f)'), { act: ['244'], reg: [] });
});

test('separates the Act sections from the Regulation sections', () => {
  assert.deepEqual(parseFormReference('Section 60; Regulation section 4.5'), { act: ['60'], reg: ['4.5'] });
  assert.deepEqual(parseFormReference('Section 241, Regulation section 14.5 (3)'), { act: ['241'], reg: ['14.5'] });
});

test('reads a list of sections', () => {
  assert.deepEqual(parseFormReference('Sections 245 (a), 246, 264'), { act: ['245', '246', '264'], reg: [] });
});

test('reads a reference that is only to the Regulation', () => {
  assert.deepEqual(parseFormReference('Regulation section 14.9'), { act: [], reg: ['14.9'] });
  assert.deepEqual(parseFormReference('Sections 17.20 and 17.21 of the Regulation'), { act: [], reg: ['17.20', '17.21'] });
});

test("expands a range, so Form E's reference reaches every section it names", () => {
  assert.deepEqual(
    parseFormReference('Sections 78, 79, 80 of the Act and sections 17.20 to 17.22 of the Regulation'),
    { act: ['78', '79', '80'], reg: ['17.20', '17.21', '17.22'] },
  );
});

test('has nothing to say about a form with no reference', () => {
  assert.deepEqual(parseFormReference(null), { act: [], reg: [] });
});
