import type {Row} from '@/lib/schema';
import {IDS} from './ids';
import {uid} from './uid';
import type {Clock} from './clock';
export function miscSeed(c:Clock):{updates:Row[];invitations:Row[];audit:Row[]}{
// Mirrors `public.notifications` (resources.updates): some read, some still `state:'new'`.
const updates:Row[]=[
 {id:uid('1a000000',1),building_id:IDS.buildings.seaside,type:'document_review',title:'Review your insurance summary',body:'Your insurance summary is ready for a human check before it becomes searchable.',severity:'info',target_id:null,state:'new',snoozed_until:null,created_at:c.ago(3)},
 {id:uid('1a000000',2),building_id:IDS.buildings.seaside,type:'draft_review',title:'EV charging amendment is still a draft',body:'Arrange a legal review and verify the supporting records before proposing the amendment.',severity:'warning',target_id:null,state:'new',snoozed_until:null,created_at:c.ago(4)},
 {id:uid('1a000000',3),building_id:IDS.buildings.harbour,type:'document_review',title:'Review your insurance summary',body:'Your insurance summary is ready for a human check before it becomes searchable.',severity:'info',target_id:null,state:'viewed',snoozed_until:null,created_at:c.ago(7)},
];
// Mirrors `public.invitations` (resources.invitations): one pending invitation, sent by James for Seaside.
const invitations:Row[]=[
 {id:uid('1b000000',1),building_id:IDS.buildings.seaside,email:'noor.aziz@example.com',role:'council_member',expires_at:c.ahead(7),accepted_at:null,revoked_at:null,created_at:c.ago(2)},
];
// Mirrors `public.audit_log` (resources.audit); ids are strings here since the real column is a bigint
// identity and `listResource` already transforms it to a string.
const audit:Row[]=[
 {id:'1',building_id:IDS.buildings.seaside,action:'documents.insert',target_id:null,occurred_at:c.ago(139),actor_id:IDS.users.james},
 {id:'2',building_id:IDS.buildings.seaside,action:'building_members.insert',target_id:IDS.users.priya,occurred_at:c.ago(117),actor_id:IDS.users.james},
 {id:'3',building_id:IDS.buildings.seaside,action:'firm_building_links.update',target_id:IDS.firmLinks.seaside,occurred_at:'2025-01-24T10:00:00Z',actor_id:IDS.users.james},
 {id:'4',building_id:IDS.buildings.harbour,action:'documents.insert',target_id:null,occurred_at:c.ago(139),actor_id:IDS.users.sarah},
 {id:'5',building_id:IDS.buildings.seaside,action:'generated_documents.update',target_id:IDS.notices.seasideApproved,occurred_at:c.ago(5),actor_id:IDS.users.sarah},
];
return {updates,invitations,audit};
}
