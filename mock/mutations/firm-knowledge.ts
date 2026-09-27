import {z} from 'zod';
import {AppError,ForbiddenError,NotFoundError} from '@/lib/errors';
import type {FirmKnowledgeData} from '@/features/knowledge/types';
import {audit,newId,type MockState} from '../store';
import {firmOf,isFirmStaff,isLinkedMember,linkedFirmId} from '../rules';
import {FIRM_COLLECTIONS,chunkFirmDoc} from '../data/firm-knowledge';
import {now,run,type Result} from './shared';
// Firm knowledge management (demo only — there is no firm knowledge table yet). The `firm` layer is readable by
// the firm's own staff only (mock/rules.ts#isFirmStaff); the owner, admins and portfolio managers may change it,
// assistants only read it. Building managers, council, residents and the platform admin get nothing — not even
// a count — from here. Every saved body is re-chunked at once, so it is answerable in Ask for firm staff straight away.
const EDITORS=['org_owner','org_admin','portfolio_manager'];
const name=(s:MockState,userId:string)=>s.profiles.find(p=>p.id===userId)?.display_name??'Someone';
function roleInFirm(s:MockState,userId:string,orgId:string):string|null{return String(s.orgMembers.find(m=>m.org_id===orgId&&m.user_id===userId&&m.status==='active')?.role??'')||null;}
/** The firm this person may manage knowledge for, or a ForbiddenError (and with `edit`, only for editors). */
function firmFor(s:MockState,userId:string,edit:boolean):string{
 const orgId=firmOf(s,userId);
 if(!orgId||!isFirmStaff(s,userId,orgId))throw new ForbiddenError();
 if(edit&&!EDITORS.includes(roleInFirm(s,userId,orgId)??''))throw new ForbiddenError();
 return orgId;
}
/** The Knowledge section's Firm tab shows on a building only for staff of the firm it is linked to, who reach it
 * through that link — the same condition under which `layersFor` adds the `firm` layer to their answers. */
export function firmTabFor(s:MockState,userId:string,buildingId:string):boolean{const firm=linkedFirmId(s,buildingId);return firm!=null&&firmOf(s,userId)===firm&&isFirmStaff(s,userId,firm)&&isLinkedMember(s,userId,buildingId);}
export function firmKnowledgeView(s:MockState,userId:string):FirmKnowledgeData{
 const orgId=firmFor(s,userId,false);
 const org=s.organizations.find(o=>o.id===orgId);
 const docs=s.firmDocs.filter(d=>d.orgId===orgId).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
 return {firm:{id:orgId,name:String(org?.name??'Your firm')},canEdit:EDITORS.includes(roleInFirm(s,userId,orgId)??''),
  collections:FIRM_COLLECTIONS.map(c=>({id:c.id,label:c.label,docs:docs.filter(d=>d.collection===c.id).map(d=>({id:d.id,collection:d.collection,title:d.title,body:d.body,parts:s.firmChunks.filter(x=>x.docId===d.id).length,updatedAt:d.updated_at,author:name(s,d.created_by)}))}))};
}
const docInput=z.object({id:z.uuid().optional(),collection:z.enum(['templates','policies','guidance','legal_tracker']),title:z.string().trim().min(3).max(160),body:z.string().trim().min(20).max(20000)});
// Precedents are stored anonymised (spec §1): refuse a unit or strata lot number, or an email address. Square-
// bracket placeholders such as "strata lot [number]" are what the seeded templates use instead.
const IDENTIFYING=/\b(?:unit|suite|apartment|apt|strata lot|sl)\s*#?\s*\d+|[\w.+-]+@[\w-]+\.[\w.]+/i;
export function saveFirmDoc(s:MockState,userId:string,raw:unknown):Result<{id:string}>{return run(()=>{
 const v=docInput.parse(raw);const orgId=firmFor(s,userId,true);
 if(IDENTIFYING.test(v.body)||IDENTIFYING.test(v.title))throw new AppError('not_anonymised','Remove unit numbers and email addresses first. Firm knowledge is stored anonymised — use placeholders like [unit].');
 let doc=v.id?s.firmDocs.find(d=>d.id===v.id&&d.orgId===orgId):undefined;
 if(v.id&&!doc)throw new NotFoundError();
 if(doc)Object.assign(doc,{collection:v.collection,title:v.title,body:v.body,updated_at:now()});
 else{doc={id:newId(),orgId,collection:v.collection,title:v.title,body:v.body,updated_at:now(),created_by:userId};s.firmDocs.push(doc);}
 const id=doc.id;
 s.firmChunks=s.firmChunks.filter(c=>c.docId!==id).concat(chunkFirmDoc(doc));
 // Firm-level audit: no building id, so it never shows in any building's audit log.
 audit(s,userId,null,v.id?'firm_documents.update':'firm_documents.insert',id);
 return {id};
});}
export function deleteFirmDoc(s:MockState,userId:string,raw:unknown):Result<object>{return run(()=>{
 const {id}=z.object({id:z.uuid()}).parse(raw);const orgId=firmFor(s,userId,true);
 if(!s.firmDocs.some(d=>d.id===id&&d.orgId===orgId))throw new NotFoundError();
 s.firmDocs=s.firmDocs.filter(d=>d.id!==id);s.firmChunks=s.firmChunks.filter(c=>c.docId!==id);
 audit(s,userId,null,'firm_documents.delete',id);
 return {};
});}
