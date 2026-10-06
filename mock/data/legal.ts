import type { LegalChunk } from '@/mock/store';
import { uid } from './uid';
import type { Clock } from './clock';
// The `legal` layer: a small mock corpus of Strata Property Act sections, one Regulation section and sample
// Civil Resolution Tribunal decisions. Visible to everyone with Ask access (mock/rules.ts#layersFor).
// TODO(legal): these are short plain-language paraphrases written for the demo, not the text of the Act or
// Regulation, and not verified against the current consolidation. The CRT decisions are fictional and every
// one is labelled "Sample" in its title and citation. Nothing here may be copied into the real legal corpus.
// When the legal corpus was last refreshed (relative to seed day, like the platform audit's sync entry).
export function legalSeed(c: Clock): LegalChunk[] {
  const UPDATED = c.ago(26);
  const act = (n: number, sec: string, heading: string, content: string): LegalChunk => ({
    id: uid('32000000', n),
    source: 'act',
    title: `Strata Property Act · s. ${sec} — ${heading}`,
    citation: `Strata Property Act, SBC 1998, c. 43, s. ${sec}`,
    sectionRef: sec,
    content,
    updated_at: UPDATED,
  });
  return [
    act(
      1,
      '26',
      'Council exercises powers and performs duties',
      'Except as otherwise provided in the Act, the regulations, the bylaws or the rules, the council must exercise the powers and perform the duties of the strata corporation, including the enforcement of bylaws and rules.',
    ),
    act(
      2,
      '31',
      'Council member’s standard of care',
      'In exercising the powers and performing the duties of the strata corporation, each council member must act honestly and in good faith with a view to the best interests of the strata corporation, and exercise the care, diligence and skill of a reasonably prudent person in comparable circumstances.',
    ),
    act(
      3,
      '130',
      'Fines',
      'The strata corporation may fine an owner if a bylaw or rule is contravened by the owner, by a visitor of the owner, or by an occupant if the strata lot is not rented. A fine may not exceed the maximum set by the bylaws, and the bylaws may not set a maximum above the amount set by the regulations.',
    ),
    act(
      4,
      '135',
      'Complaint on bylaw or rule contravention',
      'The strata corporation must not impose a fine against a person, require a person to pay the costs of remedying a contravention, or deny a person the use of a recreational facility for a contravention unless it has received a complaint about the contravention, given the owner or tenant the particulars of the complaint in writing, and given them a reasonable opportunity to answer the complaint, including a hearing if requested.',
    ),
    act(
      5,
      '141',
      'Limits on restricting rentals',
      'The strata corporation must not screen tenants, establish screening criteria, require the approval of tenants, or require the insertion of terms in tenancy agreements. Any restriction on renting a strata lot must be made by bylaw and is subject to the limits the Act places on rental restriction bylaws.',
    ),
    act(
      6,
      '165',
      'Other court remedies',
      'On application by an owner, tenant, mortgagee or other interested person, or by the strata corporation, the Supreme Court may order the strata corporation or a person to do an act required by the Act, the regulations, the bylaws or the rules, or to stop contravening them.',
    ),
    {
      id: uid('32000000', 7),
      source: 'regulation',
      title: 'Strata Property Regulation · s. 7.1 — Maximum fines',
      citation: 'Strata Property Regulation, BC Reg 43/2000, s. 7.1',
      sectionRef: '7.1',
      content:
        'The maximum fine a strata corporation may set in its bylaws is $200 for each contravention of a bylaw and $50 for each contravention of a rule. A bylaw may set a lower maximum.',
      updated_at: UPDATED,
    },
    {
      id: uid('32000000', 8),
      source: 'crt',
      title: 'Sample CRT decision (fictional) — noise fines reversed for lack of a hearing',
      citation: 'Sample decision, 2025 BCCRT 9101 (fictional)',
      sectionRef: 'para. 24',
      content:
        'The tribunal found that the strata corporation imposed noise fines without giving the owner the particulars of the complaint in writing or the hearing the owner asked for. Because the s. 135 process was not followed, the fines were not valid and were ordered reversed.',
      updated_at: UPDATED,
    },
    {
      id: uid('32000000', 9),
      source: 'crt',
      title: 'Sample CRT decision (fictional) — emotional support animal and a pet bylaw',
      citation: 'Sample decision, 2026 BCCRT 9214 (fictional)',
      sectionRef: 'para. 31',
      content:
        'The tribunal found that the strata corporation should have considered the owner’s request to keep an emotional support animal as an accommodation request before enforcing its pet bylaw. The pet bylaw fines were ordered refunded.',
      updated_at: UPDATED,
    },
    {
      id: uid('32000000', 10),
      source: 'crt',
      title: 'Sample CRT decision (fictional) — fine above the bylaw maximum',
      citation: 'Sample decision, 2026 BCCRT 9377 (fictional)',
      sectionRef: 'para. 18',
      content:
        'The tribunal found that a fine was only enforceable up to the maximum set in the strata corporation’s own bylaws. The portion of the fine above the bylaw maximum was ordered refunded, even though it was within the amount the regulations allow.',
      updated_at: UPDATED,
    },
  ];
}
