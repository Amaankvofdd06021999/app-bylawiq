import type { Row } from '@/lib/schema';
import { IDS } from './ids';
import { uid } from './uid';
import type { Clock } from './clock';
// Mirrors `public.disputes` / `public.dispute_events` (resources.disputes / resources.events). `next_deadline` and
// `deadline_label` are mock-only (no such columns yet): the date the warning letter gave the owner to answer, used by
// the dashboards' "deadlines within 14 days". They are not in `resources.disputes`, so no section page reads them.
export function disputeSeed(c: Clock): { disputes: Row[]; events: Row[] } {
  const disputes: Row[] = [
    {
      id: uid('19000000', 1),
      building_id: IDS.buildings.seaside,
      title: 'Noise contravention · Unit 812',
      reference: 'D-2026-001',
      category: 'noise',
      subject_unit: '812',
      stage: 'warning_sent',
      created_at: c.ago(13),
      next_deadline: c.date(9),
      deadline_label: 'Owner’s written response due',
    },
    {
      id: uid('19000000', 2),
      building_id: IDS.buildings.seaside,
      title: 'Visitor parking enquiry · Unit 1204',
      reference: 'D-2026-002',
      category: 'parking',
      subject_unit: '1204',
      stage: 'reported',
      created_at: c.ago(8),
      next_deadline: null,
      deadline_label: null,
    },
  ];
  const events: Row[] = [
    {
      id: uid('19000001', 1),
      building_id: IDS.buildings.seaside,
      dispute_id: disputes[0].id,
      stage: 'reported',
      occurred_at: c.ago(13),
      logged_at: c.ago(13, '10:00'),
      summary: 'Neighbouring resident reported noise after quiet hours.',
      actor_id: IDS.users.james,
    },
    {
      id: uid('19000001', 2),
      building_id: IDS.buildings.seaside,
      dispute_id: disputes[0].id,
      stage: 'warning_sent',
      occurred_at: c.ago(12),
      logged_at: c.ago(12, '09:30'),
      summary: 'Written warning sent to the owner of Unit 812.',
      actor_id: IDS.users.james,
    },
    {
      id: uid('19000001', 3),
      building_id: IDS.buildings.seaside,
      dispute_id: disputes[1].id,
      stage: 'reported',
      occurred_at: c.ago(8),
      logged_at: c.ago(8, '09:15'),
      summary: 'Resident asked about visitor parking permit hours for a family visit.',
      actor_id: IDS.users.james,
    },
  ];
  return { disputes, events };
}
