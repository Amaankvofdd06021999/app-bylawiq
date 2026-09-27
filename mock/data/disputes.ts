import type {Row} from '@/lib/schema';
import {IDS} from './ids';
import {uid} from './uid';
// Mirrors `public.disputes` / `public.dispute_events` (resources.disputes / resources.events). `next_deadline` and
// `deadline_label` are mock-only (no such columns yet): the date the warning letter gave the owner to answer, used by
// the dashboards' "deadlines within 14 days". They are not in `resources.disputes`, so no section page reads them.
export const disputes:Row[]=[
 {id:uid('19000000',1),building_id:IDS.buildings.seaside,title:'Noise contravention · Unit 812',reference:'D-2026-001',category:'noise',subject_unit:'812',stage:'warning_sent',created_at:'2026-09-14T09:00:00Z',next_deadline:'2026-10-06',deadline_label:'Owner’s written response due'},
 {id:uid('19000000',2),building_id:IDS.buildings.seaside,title:'Visitor parking enquiry · Unit 1204',reference:'D-2026-002',category:'parking',subject_unit:'1204',stage:'reported',created_at:'2026-09-19T09:00:00Z',next_deadline:null,deadline_label:null},
];
export const events:Row[]=[
 {id:uid('19000001',1),building_id:IDS.buildings.seaside,dispute_id:disputes[0].id,stage:'reported',occurred_at:'2026-09-14T09:00:00Z',logged_at:'2026-09-14T10:00:00Z',summary:'Neighbouring resident reported noise after quiet hours.',actor_id:IDS.users.james},
 {id:uid('19000001',2),building_id:IDS.buildings.seaside,dispute_id:disputes[0].id,stage:'warning_sent',occurred_at:'2026-09-15T09:00:00Z',logged_at:'2026-09-15T09:30:00Z',summary:'Written warning sent to the owner of Unit 812.',actor_id:IDS.users.james},
 {id:uid('19000001',3),building_id:IDS.buildings.seaside,dispute_id:disputes[1].id,stage:'reported',occurred_at:'2026-09-19T09:00:00Z',logged_at:'2026-09-19T09:15:00Z',summary:'Resident asked about visitor parking permit hours for a family visit.',actor_id:IDS.users.james},
];
