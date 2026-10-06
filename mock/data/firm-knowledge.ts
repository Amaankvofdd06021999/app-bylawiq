import type { FirmChunk, FirmCollection, FirmDoc } from '@/mock/store';
import { IDS } from './ids';
import { uid } from './uid';
import type { Clock } from './clock';
// Coastline Strata's firm knowledge — the `firm` layer (see mock/rules.ts#layersFor). Internal practice, not
// law or bylaw: visible to Coastline staff only. Precedents are stored anonymised — placeholders in square
// brackets stand in for names, units and addresses, and no building's own facts appear here.
// "Fine schedule guidance" deliberately assumes a $200 maximum so a question about noise fines at Seaside
// Towers (whose bylaws cap noise fines at $100) surfaces the conflict the layered answer must name.
export const FIRM_COLLECTIONS: { id: FirmCollection; label: string }[] = [
  { id: 'templates', label: 'Templates & precedents' },
  { id: 'policies', label: 'Policies & procedures' },
  { id: 'guidance', label: 'Guidance notes' },
  { id: 'legal_tracker', label: 'CRT & legislation tracker' },
];
/** Splits a firm document's body into chunks, one per paragraph (blank-line separated), numbered "Part N".
 * Shared by the seed and by firm-knowledge edits, so a saved document is answerable the same way. */
export function chunkFirmDoc(doc: Pick<FirmDoc, 'id' | 'orgId' | 'body'>): FirmChunk[] {
  return doc.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((content, i) => ({ docId: doc.id, orgId: doc.orgId, sectionRef: 'Part ' + (i + 1), content }));
}
const doc = (
  n: number,
  collection: FirmCollection,
  title: string,
  body: string,
  updated_at: string,
  created_by: string = IDS.users.sarah,
): FirmDoc => ({
  id: uid('31000000', n),
  orgId: IDS.orgs.coastline,
  collection,
  title,
  body,
  updated_at,
  created_by,
});
export function firmSeed(c: Clock): { firmDocs: FirmDoc[]; firmChunks: FirmChunk[] } {
  const firmDocs: FirmDoc[] = [
    doc(
      1,
      'templates',
      's.135 notice template',
      `Use this template when a written complaint alleges a bylaw contravention and council is considering a fine. Send it before any fine is imposed.

Dear [Owner or tenant name], strata lot [number]: the strata corporation has received a complaint that on [date] you contravened bylaw [section] ([short title]). The particulars of the complaint are: [particulars].

You may answer the complaint in writing, or request a hearing before council, within [number] days of receiving this letter. Council will not decide whether to impose a fine or other consequence until that time has passed or you have been heard.

Signed on behalf of the strata council by [manager name], [firm letterhead].`,
      c.ago(105),
      IDS.users.dana,
    ),
    doc(
      2,
      'templates',
      'Precedent: reply to a first noise complaint (anonymised)',
      `Precedent from a residential building of about 120 lots. Names, units and the building have been removed.

Thank you for reporting the noise from the unit above yours on [dates]. We have written to the owner of that unit setting out the complaint and the quiet hours in your building’s bylaws, and invited a response.

If the noise continues, please keep a short log of dates, times and what you heard. A log helps council decide whether a further step, such as a fine under the bylaws, is warranted.`,
      c.ago(178),
    ),
    doc(
      3,
      'policies',
      'Noise complaint procedure',
      `Step 1 — intake. Log every noise complaint in the building file within one business day, with the complainant’s dates and times. Do not name the complainant to the respondent unless council has decided it is necessary.

Step 2 — first contact. Send the respondent a courtesy letter quoting the building’s quiet hours bylaw. A courtesy letter is not a fine and does not start the s.135 process.

Step 3 — repeat complaint. If a second complaint arrives within 60 days, prepare the s.135 notice template for council approval. Check the building’s own bylaws for the fine amount before drafting.

Step 4 — decision. Council decides after the response period closes. Record the decision and the reasons in the minutes and send it in writing to the respondent.`,
      c.ago(69),
      IDS.users.dana,
    ),
    doc(
      4,
      'policies',
      'Bylaw enforcement escalation policy',
      `Coastline managers escalate a bylaw matter to the portfolio manager when a respondent disputes the facts, requests a hearing, or raises a human rights accommodation.

Any matter likely to reach the Civil Resolution Tribunal is flagged in the dispute tracker with its deadline, and the building’s council is told in writing within five business days.`,
      c.ago(142),
      IDS.users.dana,
    ),
    doc(
      5,
      'guidance',
      'Fine schedule guidance — assumes $200 max',
      `Coastline’s default fine schedule assumes the maximum bylaw fine of $200 per contravention. For a repeat noise contravention after a written warning, recommend a $200 fine.

Before quoting any fine to an owner, confirm the amount against the building’s own registered bylaws. A building’s bylaws may set a lower amount, and the lower amount governs.`,
      c.ago(181),
    ),
    doc(
      6,
      'guidance',
      'Pets and accommodation requests — guidance note',
      `When an owner asks to keep an animal the pet bylaw would otherwise not allow, treat the request as a possible accommodation request and do not refuse it on the pet bylaw alone.

Ask for information that supports the request, keep it confidential, and bring the request to council with a recommendation. Record council’s decision and reasons.`,
      c.ago(228),
    ),
    doc(
      7,
      'legal_tracker',
      'CRT tracker: pets and emotional support animals',
      `Sample tracker entry (fictional decisions, for the demo only). Tribunal decisions on emotional support animals turn on the evidence of need and on whether the strata corporation considered the request before enforcing its pet bylaw.

Practice point: where a strata corporation fined an owner under a pet bylaw without first considering an accommodation request, the fines were at risk of being reversed. Review the request before any fine.`,
      c.ago(53),
    ),
    doc(
      8,
      'legal_tracker',
      'Legislation tracker: fines and the s.135 process',
      `Sample tracker entry for the demo. A fine is only enforceable if the strata corporation followed the s.135 complaint process first: particulars in writing and a reasonable opportunity to answer, including a hearing if requested.

Watch item: check the current Strata Property Regulation for the maximum fine amounts before each annual update of the default fine schedule.`,
      c.ago(26),
    ),
  ];
  return { firmDocs, firmChunks: firmDocs.flatMap(chunkFirmDoc) };
}
