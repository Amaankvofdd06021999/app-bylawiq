import type { Row } from '@/lib/schema';
import { IDS } from './ids';
import { uid } from './uid';
import type { Clock } from './clock';
// Mirrors `public.generated_documents` (see `resources.notices` in features/workspace/queries.ts) and
// `public.document_review_comments`. Covers every review state the demo's review flow needs: draft,
// pending firm review, changes requested (with the firm's comment) and approved.
export function noticeSeed(c: Clock): { notices: Row[]; comments: Row[] } {
  const notices: Row[] = [
    {
      id: IDS.notices.seasideDraft,
      building_id: IDS.buildings.seaside,
      dispute_id: null,
      kind: 'email',
      title: 'Visitor parking · Draft response',
      body_md:
        'Thank you for your enquiry about visitor parking. Please review section 4.1 of the bylaws before the next reply.',
      status: 'draft',
      review_by: 'building',
      created_by: IDS.users.james,
      approved_by: null,
      approved_at: null,
      sent_at: null,
      created_at: c.ago(12),
    },
    {
      id: IDS.notices.seasidePendingReview,
      building_id: IDS.buildings.seaside,
      dispute_id: null,
      kind: 's135_notice',
      title: 'Noise contravention · Unit 812',
      body_md:
        'This notice advises the owner of Unit 812 of a bylaw contravention regarding noise after quiet hours, under section 3.1 of the registered bylaws.',
      status: 'pending_review',
      review_by: 'firm',
      created_by: IDS.users.james,
      approved_by: null,
      approved_at: null,
      sent_at: null,
      created_at: c.ago(7),
    },
    {
      id: IDS.notices.seasideChangesRequested,
      building_id: IDS.buildings.seaside,
      dispute_id: null,
      kind: 'council_report',
      title: 'September council report',
      body_md:
        'For council review: confirm the current document set and review the proposed EV charging amendment.',
      status: 'changes_requested',
      review_by: 'firm',
      created_by: IDS.users.james,
      approved_by: null,
      approved_at: null,
      sent_at: null,
      created_at: c.ago(17),
    },
    {
      id: IDS.notices.seasideApproved,
      building_id: IDS.buildings.seaside,
      dispute_id: null,
      kind: 'email',
      title: 'Move-in fee · Reminder to Unit 1204',
      body_md:
        'This is a reminder that the refundable move-in deposit is payable before keys are issued, under the move-in package.',
      status: 'approved',
      review_by: 'firm',
      created_by: IDS.users.james,
      approved_by: IDS.users.sarah,
      approved_at: c.ago(5),
      sent_at: null,
      created_at: c.ago(9),
    },
    {
      id: IDS.notices.harbourPendingReview,
      building_id: IDS.buildings.harbour,
      dispute_id: null,
      kind: 'council_report',
      title: 'Harbour View council report · Q3',
      body_md: 'For council review: confirm the current insurance renewal and the reserve fund contribution.',
      status: 'pending_review',
      review_by: 'firm',
      created_by: IDS.users.nina,
      approved_by: null,
      approved_at: null,
      sent_at: null,
      created_at: c.ago(6),
    },
  ];
  const comments: Row[] = [
    {
      id: uid('18000000', 1),
      building_id: IDS.buildings.seaside,
      document_id: IDS.notices.seasideChangesRequested,
      author_id: IDS.users.sarah,
      body: 'Please cite the specific bylaw section before this goes to council, and confirm the EV charging draft is ready for review.',
      created_at: c.ago(16),
    },
  ];
  return { notices, comments };
}
