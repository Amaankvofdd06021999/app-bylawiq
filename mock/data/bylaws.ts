import type {Row} from '@/lib/schema';
import {IDS} from './ids';
import {uid} from './uid';
// Bylaws + versions for Seaside and Harbour, reusing the sample provisions from `lib/preview.ts` (quiet
// hours, pets, visitor parking, EV charging). Columns match `bylaw_nodes`/`bylaw_versions` as selected by
// `features/workspace/queries.ts`'s `resources.bylaws`/`resources.versions`.
const setId=uid('15000000',1);
function nodes(buildingId:string,prefix:string):Row[]{
 return [
  {id:uid(prefix,1),building_id:buildingId,title:'Quiet hours & nuisance',section_ref:'3.1',set_id:setId,created_at:'2025-03-01T09:00:00Z'},
  {id:uid(prefix,2),building_id:buildingId,title:'Pets & animals',section_ref:'3.2',set_id:setId,created_at:'2025-03-01T09:00:00Z'},
  {id:uid(prefix,3),building_id:buildingId,title:'Visitor parking',section_ref:'4.1',set_id:setId,created_at:'2025-03-01T09:00:00Z'},
  {id:uid(prefix,4),building_id:buildingId,title:'Electric vehicle charging',section_ref:'4.3',set_id:setId,created_at:'2025-03-01T09:00:00Z'},
 ];
}
function nodeVersions(buildingId:string,n:Row[],createdBy:string,prefix:string):Row[]{
 return [
  {id:uid(prefix,1),building_id:buildingId,node_id:n[0].id,version:1,status:'in_force',body:'Residents and visitors must observe quiet hours between 10:00 pm and 7:00 am.',rationale:'Sample current version.',effective_date:'2025-03-12',filing_reference:'LF-2025-0182',created_by:createdBy,review_choice:'counsel',source_document_id:null,created_at:'2025-03-01T09:00:00Z'},
  {id:uid(prefix,2),building_id:buildingId,node_id:n[1].id,version:1,status:'in_force',body:'Review the complete pet and accommodation provisions together before making a decision.',rationale:'Sample current version.',effective_date:'2025-03-12',filing_reference:'LF-2025-0182',created_by:createdBy,review_choice:'counsel',source_document_id:null,created_at:'2025-03-01T09:00:00Z'},
  {id:uid(prefix,3),building_id:buildingId,node_id:n[2].id,version:1,status:'in_force',body:'Visitor parking spaces are reserved for guests of the building.',rationale:'Sample current version.',effective_date:'2025-03-12',filing_reference:'LF-2025-0182',created_by:createdBy,review_choice:'counsel',source_document_id:null,created_at:'2025-03-01T09:00:00Z'},
  {id:uid(prefix,4),building_id:buildingId,node_id:n[3].id,version:1,status:'draft',body:'Draft a process for reviewing requests for electric vehicle charging.',rationale:'',effective_date:null,filing_reference:null,created_by:createdBy,review_choice:null,source_document_id:null,created_at:'2026-08-20T09:00:00Z'},
 ];
}
const seasideNodes=nodes(IDS.buildings.seaside,'16000001');
const harbourNodes=nodes(IDS.buildings.harbour,'16000002');
export const bylaws:Row[]=[...seasideNodes,...harbourNodes];
export const versions:Row[]=[...nodeVersions(IDS.buildings.seaside,seasideNodes,IDS.users.james,'17000001'),...nodeVersions(IDS.buildings.harbour,harbourNodes,IDS.users.sarah,'17000002')];
