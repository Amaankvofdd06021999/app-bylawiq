import type { Row } from '@/lib/schema';
import { IDS } from './ids';
import { uid } from './uid';
type Chunk = { documentId: string; buildingId: string; sectionRef: string | null; content: string };
type Topics = {
  quietHours: string;
  pets: string;
  parking: string;
  rentals: string;
  moveInFee: string;
  fineSchedule: string;
  elevatorBooking: string;
};
// Each building gets its own noise/pet/parking/rental/move-in provisions so a cross-building leak would be
// obvious in the demo (the same rule the real RLS boundary enforces — see AGENTS.md §0).
const topics: Record<string, Topics> = {
  harbour: {
    quietHours:
      'Residents and visitors must not create noise that disturbs other residents between 11:00 pm and 7:00 am.',
    pets: 'An owner or tenant may keep no more than two pets, and a dog must weigh under 25 lb. New pets must be registered with the council within 30 days.',
    parking:
      'The 12 visitor parking stalls are reserved for guests of residents for a maximum of four consecutive hours. A parking permit from the building manager is required for longer visits.',
    rentals:
      'A strata lot may be rented, provided the lease term is at least six months and the tenant is given a copy of the bylaws before moving in.',
    moveInFee: 'A refundable $250 move-in/move-out deposit is payable to the strata before keys are issued.',
    fineSchedule:
      'A first bylaw contravention draws a written warning; a second within 12 months draws a $200 fine.',
    elevatorBooking:
      'The service elevator must be booked with the building manager at least 48 hours before a move.',
  },
  marina: {
    quietHours: 'No resident may create noise audible in another strata lot between 10:00 pm and 8:00 am.',
    pets: 'One pet under 20 lb is permitted per strata lot. A pet must not be left unattended on a balcony.',
    parking:
      'Parking stalls are assigned to strata lots. A visitor stall may be used for no more than 24 hours; the strata may have a vehicle towed at the owner’s expense after that.',
    rentals:
      'Rentals are capped at 20% of the strata lots at any time. An owner must apply to the council before advertising a rental.',
    moveInFee: 'A non-refundable $150 move-in fee is payable to the strata before keys are issued.',
    fineSchedule:
      'A bylaw contravention draws a $100 fine for each seven-day period the contravention continues.',
    elevatorBooking:
      'The freight elevator must be booked through the concierge at least 24 hours before a move.',
  },
  seaside: {
    quietHours:
      'Quiet hours run from 10:00 pm to 7:00 am. Construction or renovation noise is not permitted before 9:00 am on weekends.',
    pets: 'A strata lot may keep up to two pets with a combined weight under 30 lb. A cat kept outside a strata lot must be spayed or neutered.',
    parking:
      'Visitor parking permits are issued by the building manager and are valid for 72 hours. EV charging stalls are reserved for vehicles registered with the manager.',
    rentals:
      'The minimum rental term is three months. A short-term rental of less than 30 days is not permitted.',
    moveInFee:
      'A refundable $300 move-in deposit is payable to the strata, and the elevator must be booked at least 72 hours before a move.',
    fineSchedule:
      'A fine for noise under bylaw 3.1 is capped at $100 per contravention and follows a written warning. Any other bylaw contravention draws a fine of up to $200 after a written warning.',
    elevatorBooking: 'The elevator must be booked with the building manager at least 72 hours before a move.',
  },
  parkside: {
    quietHours: 'Quiet hours run from 9:30 pm to 7:30 am.',
    pets: 'A pet over 15 kg is not permitted. A pet application must be approved by the council before a pet moves in.',
    parking:
      'Two visitor stalls are available on a first-come basis. Overnight parking requires the building manager’s written permission.',
    rentals:
      'Rentals are not restricted, but the tenant’s contact information must be filed with the building manager within 10 days of moving in.',
    moveInFee:
      'A $100 move-in fee and a $200 refundable damage deposit are payable to the strata before keys are issued.',
    fineSchedule: 'A bylaw contravention draws a $150 fine after a written warning.',
    elevatorBooking: 'The elevator must be booked with the building manager at least 24 hours before a move.',
  },
};
// `kbId` puts the bylaws and rules in the building's seeded knowledge base, so `deploy_agent`'s ready-source
// check passes for the seeded agent the same way it would for a real building.
function buildingDocs(
  slug: string,
  buildingId: string,
  uploaderId: string,
  prefix: string,
  kbId: string,
): { documents: Row[]; chunks: Chunk[] } {
  const t = topics[slug];
  const d = (n: number, title: string, type: string, extra: Record<string, unknown> = {}): Row => ({
    id: uid(prefix, n),
    building_id: buildingId,
    title,
    type,
    status: 'ready',
    owner_visible: false,
    uploaded_by: uploaderId,
    byte_size: 96000 + n * 11000,
    created_at: '2026-05-' + String(10 + n).padStart(2, '0') + 'T09:00:00Z',
    ...extra,
  });
  const c = (documentId: string, sectionRef: string | null, content: string): Chunk => ({
    documentId,
    buildingId,
    sectionRef,
    content,
  });
  const docs: Row[] = [
    d(1, 'Registered bylaws · Consolidated 2025', 'bylaws', {
      owner_visible: true,
      knowledge_base_id: kbId,
      effective_date: '2025-03-12',
      lto_filing_ref: 'LF-2025-0182',
      // A manager has confirmed the parsed sections, which is what lets retrieval use a bylaws document.
      structure_confirmed: true,
    }),
    d(2, 'Building rules · Common areas', 'rules', {
      owner_visible: true,
      knowledge_base_id: kbId,
      effective_date: '2025-03-12',
    }),
    d(3, 'Move-in package · Guide for new owners', 'other', { owner_visible: true }),
    d(4, 'Council meeting minutes · June 2026', 'council_minutes'),
    d(5, 'AGM minutes · March 2026', 'agm_minutes'),
    // Marina Court's manager has already confirmed its insurance summary, so Marina is the healthy building in
    // Sarah's portfolio; the others still have it waiting for a human check.
    d(6, 'Insurance summary · 2026–2027', 'insurance', { status: slug === 'marina' ? 'ready' : 'review' }),
    d(7, 'Strata plan · Original filing', 'strata_plan'),
    d(8, 'Financial statements · 2025', 'financial_statements'),
  ];
  const [bylawsDoc, rulesDoc, moveInDoc, minutesDoc, agmDoc, insuranceDoc, planDoc, financialDoc] = docs;
  const chunks: Chunk[] = [
    c(bylawsDoc.id, '3.1', t.quietHours),
    c(bylawsDoc.id, '3.2', t.pets),
    c(bylawsDoc.id, '4.1', t.parking),
    c(bylawsDoc.id, '4.4', t.rentals),
    c(
      rulesDoc.id,
      'R.2',
      'Visitor parking is available on the terms posted at each entrance and enforced by the building manager.',
    ),
    c(rulesDoc.id, 'R.6', t.fineSchedule),
    c(moveInDoc.id, 'M.1', t.moveInFee),
    c(moveInDoc.id, 'M.2', t.elevatorBooking),
    c(minutesDoc.id, null, 'Council reviewed the landscaping contract for next season and approved renewal.'),
    c(
      minutesDoc.id,
      null,
      'Council noted a resident enquiry about visitor parking hours and referred it to the building manager.',
    ),
    c(
      agmDoc.id,
      null,
      'The annual general meeting approved the operating budget for the coming fiscal year.',
    ),
    c(agmDoc.id, null, 'Owners voted to maintain the existing contingency reserve fund contribution.'),
    c(
      insuranceDoc.id,
      null,
      'The building policy covers common property loss, liability and directors and officers coverage.',
    ),
    c(
      insuranceDoc.id,
      null,
      'A depreciation report informs the reserve fund contribution reviewed with this renewal.',
    ),
    c(
      planDoc.id,
      null,
      'The strata plan describes the boundaries of each strata lot and the common property.',
    ),
    c(
      planDoc.id,
      null,
      'Limited common property, including parking stalls and storage lockers, is shown on the filed plan.',
    ),
    c(financialDoc.id, null, 'Operating expenses for the year were within the approved budget.'),
    c(
      financialDoc.id,
      null,
      'The contingency reserve fund balance increased in line with the approved plan.',
    ),
  ];
  return { documents: docs, chunks };
}
const harbour = buildingDocs(
  'harbour',
  IDS.buildings.harbour,
  IDS.users.sarah,
  '20000001',
  uid('21000001', 1),
);
const marina = buildingDocs('marina', IDS.buildings.marina, IDS.users.sarah, '20000002', uid('21000002', 1));
const seaside = buildingDocs(
  'seaside',
  IDS.buildings.seaside,
  IDS.users.james,
  '20000003',
  uid('21000003', 1),
);
const parkside = buildingDocs(
  'parkside',
  IDS.buildings.parkside,
  IDS.users.omar,
  '20000004',
  uid('21000004', 1),
);
export const documents: Row[] = [
  ...harbour.documents,
  ...marina.documents,
  ...seaside.documents,
  ...parkside.documents,
];
export const chunks: Chunk[] = [...harbour.chunks, ...marina.chunks, ...seaside.chunks, ...parkside.chunks];
