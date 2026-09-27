import 'server-only';
import {z} from 'zod';
import {createUIMessageStream,createUIMessageStreamResponse} from 'ai';
import {chatSchema} from '@/lib/schema';
import {errorResponse,AppError,NotFoundError,ForbiddenError} from '@/lib/errors';
import {DISCLAIMER,DOCUMENT_TYPES} from '@/lib/constants';
import {NO_GROUNDING} from '@/lib/ai/citations';
import {exportPdf,exportDocx} from '@/lib/export';
import type {BylawMessage} from '@/lib/chat-types';
import {demoSession} from './session';
import {getStore,newId,audit,type MockState} from './store';
import {visibleDocuments,linkedFirmId} from './rules';
import {need,now} from './mutations/shared';
import {canUseChat,isResidentAsker,spendQuestion} from './mutations/chat';
import {answer} from './answers';
// Demo stand-ins for `app/api/*/route.ts`: same request/response contracts, but reading and writing the
// session's own in-memory `MockState` instead of Postgres — the mock's RLS boundary is `mock/rules.ts`,
// checked here the same way `requirePermission` is checked in the real routes (see AGENTS.md §0). Every
// route file under `app/api/demo/` is a one-line wrapper around a handler here.
type Session={s:MockState;userId:string};
async function gate():Promise<Session|Response>{
 if(process.env.DEMO_MODE!=='on')return new Response(null,{status:404});
 const session=await demoSession();
 if(!session)return Response.json({error:'Please sign in to continue.'},{status:401});
 return {s:getStore(session.sessionId),userId:session.persona.userId};
}
export async function upload(req:Request):Promise<Response>{
 const g=await gate();if(g instanceof Response)return g;
 const {s,userId}=g;
 try{
  const f=await req.formData();
  const v=z.object({buildingId:z.uuid(),title:z.string().min(1).max(180),type:z.enum(DOCUMENT_TYPES),knowledgeBaseId:z.union([z.uuid(),z.literal('')]),effectiveDate:z.union([z.iso.date(),z.literal('')]),filingReference:z.string().max(100),consent:z.literal('on')}).parse(Object.fromEntries(f));
  need(s,userId,'vault.upload',v.buildingId);
  const file=f.get('file');
  if(!(file instanceof File)||file.size<1)throw new AppError('file_type','Choose a file to upload.');
  const id=newId();const isBylaw=v.type==='bylaws';
  s.documents.push({id,building_id:v.buildingId,title:v.title,type:v.type,status:isBylaw?'review':'ready',owner_visible:false,uploaded_by:userId,byte_size:file.size,knowledge_base_id:v.knowledgeBaseId||null,effective_date:v.effectiveDate||null,lto_filing_ref:v.filingReference||null,structure_confirmed:!isBylaw,created_at:now(),...(isBylaw?{parsed_sections:[{heading:v.title,ordinal:1}]}:{})});
  s.chunks.push({documentId:id,buildingId:v.buildingId,sectionRef:null,content:v.title+' — '+file.name});
  audit(s,userId,v.buildingId,'documents.insert',id);
  return Response.json({id},{status:201});
 }catch(e){return errorResponse(e);}
}
export async function uploadRetry(req:Request):Promise<Response>{
 const g=await gate();if(g instanceof Response)return g;
 const {s,userId}=g;
 try{
  const v=z.object({documentId:z.uuid()}).parse(await req.json());
  const doc=s.documents.find(d=>d.id===v.documentId);
  if(!doc)throw new NotFoundError();
  need(s,userId,'vault.upload',String(doc.building_id));
  if(!['failed','uploaded'].includes(String(doc.status)))throw new AppError('already_processing','This document is already processing.');
  doc.status='ready';
  audit(s,userId,String(doc.building_id),'documents.update',doc.id);
  return Response.json({ok:true});
 }catch(e){return errorResponse(e);}
}
export async function sources(req:Request):Promise<Response>{
 const g=await gate();if(g instanceof Response)return g;
 const {s,userId}=g;
 try{
  const v=z.object({buildingId:z.uuid(),title:z.string().min(1).max(180),url:z.url(),knowledgeBaseId:z.uuid().nullable(),consent:z.literal(true)}).parse(await req.json());
  need(s,userId,'vault.upload',v.buildingId);
  const id=newId();
  s.documents.push({id,building_id:v.buildingId,title:v.title,type:'other',status:'ready',owner_visible:false,uploaded_by:userId,source_url:v.url,knowledge_base_id:v.knowledgeBaseId,structure_confirmed:true,created_at:now()});
  s.chunks.push({documentId:id,buildingId:v.buildingId,sectionRef:null,content:v.title});
  audit(s,userId,v.buildingId,'documents.insert',id);
  return Response.json({id},{status:201});
 }catch(e){return errorResponse(e);}
}
export async function download(_req:Request,params:{id:string}):Promise<Response>{
 const g=await gate();if(g instanceof Response)return g;
 const {s,userId}=g;
 try{
  const {id}=z.object({id:z.uuid()}).parse(params);
  const doc=s.documents.find(d=>d.id===id);
  if(!doc)throw new NotFoundError();
  const buildingId=String(doc.building_id);
  need(s,userId,'vault.read',buildingId);
  // Mirrors `docs_read`: a resident only ever sees `visibleDocuments`, so a doc outside that set is a 404,
  // exactly like the real route's `.single()` returning no row once RLS filters it out (AGENTS.md §0).
  if(!visibleDocuments(s,userId,buildingId).some(d=>d.id===id))throw new NotFoundError();
  const chunks=s.chunks.filter(c=>c.documentId===id);
  const body=(chunks.map(c=>(c.sectionRef?c.sectionRef+' — ':'')+c.content).join('\n\n'))||String(doc.title);
  const filename=String(doc.title).replace(/[^\w.-]+/g,'_')||'document';
  return new Response(body,{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="'+filename+'.txt"','Cache-Control':'private, no-store'}});
 }catch(e){return errorResponse(e);}
}
export async function exportArtifact(req:Request,params:{id:string}):Promise<Response>{
 const g=await gate();if(g instanceof Response)return g;
 const {s,userId}=g;
 try{
  const {id}=z.object({id:z.uuid()}).parse(params);
  const format=z.enum(['pdf','docx']).parse(new URL(req.url).searchParams.get('format')||'pdf');
  const notice=s.notices.find(n=>n.id===id);
  if(!notice)throw new NotFoundError();
  const buildingId=String(notice.building_id);
  need(s,userId,'chat.use',buildingId);
  const building=s.buildings.find(b=>b.id===buildingId);
  if(!building)throw new NotFoundError();
  const firmId=linkedFirmId(s,buildingId);
  const firm=firmId?s.organizations.find(o=>o.id===firmId):undefined;
  const body=String(notice.body_md)+'\n\n'+(firm?String(firm.signature_block||''):'');
  const bytes=format==='pdf'?await exportPdf(String(notice.title),body,building.name,String(notice.status),firm?String(firm.letterhead||''):''):await exportDocx(String(notice.title),body,building.name,String(notice.status),firm?String(firm.letterhead||''):'');
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename="BylawIQ-'+id.slice(0,8)+'.'+format+'"','Cache-Control':'private, no-store'}});
 }catch(e){return errorResponse(e);}
}
export async function chat(req:Request):Promise<Response>{
 const g=await gate();if(g instanceof Response)return g;
 const {s,userId}=g;
 try{
  // `layers` is the demo's knowledge-layer filter (Building · Firm · Law chips); `answer` intersects it with
  // what `layersFor` allows, so asking for a layer you can't see simply finds nothing in it.
  const v=z.object({id:z.uuid(),message:z.object({id:z.uuid(),role:z.literal('user'),parts:z.array(z.object({type:z.literal('text'),text:z.string().min(1).max(20000)})).min(1).max(1)}),layers:z.array(z.enum(['building','firm','legal'])).min(1).max(3).optional()}).parse(await req.json());
  const row=s.chats.find(c=>c.id===v.id);
  if(!row)throw new NotFoundError();
  const chatRow=chatSchema.parse(row);
  // Mirrors `public.can_use_chat`: only the chat's own user, and only with `chat.use` on its building (or,
  // demo only, a resident with paid Ask on it).
  if(!canUseChat(s,userId,chatRow.id))throw new ForbiddenError();
  const buildingId=chatRow.building_id?String(chatRow.building_id):'';
  // A resident pays per question (free questions first). Checked before anything is saved, so a paywalled
  // question leaves no trace in the conversation.
  if(buildingId&&isResidentAsker(s,userId,buildingId)&&!spendQuestion(s,userId,buildingId))return Response.json({error:'You’re out of credits.',code:'paywall'},{status:402});
  const question=v.message.parts[0].text;
  s.messages.push({id:v.message.id,chatId:chatRow.id,role:'user',parts:v.message.parts});
  const assistantId=newId();
  const stream=createUIMessageStream<BylawMessage>({execute:async({writer})=>{
   writer.write({type:'start',messageId:assistantId});
   writer.write({type:'data-progress',id:'progress',data:{label:'Searching sample documents'},transient:true});
   const result=answer(s,userId,buildingId,question,v.layers);
   const parts:BylawMessage['parts']=[];
   if(!result.sources.length){
    const value=NO_GROUNDING+'\n\n'+DISCLAIMER;
    writer.write({type:'text-start',id:'answer'});writer.write({type:'text-delta',id:'answer',delta:value});writer.write({type:'text-end',id:'answer'});
    parts.push({type:'text',text:value});
   }else{
    writer.write({type:'data-answer',id:'grounded-answer',data:result});
    parts.push({type:'data-answer',id:'grounded-answer',data:result});
   }
   writer.write({type:'finish',finishReason:'stop'});
   s.messages.push({id:assistantId,chatId:chatRow.id,role:'assistant',parts});
   const stored=s.chats.find(c=>c.id===chatRow.id);
   if(stored){stored.updated_at=now();if(stored.title==='New conversation')stored.title=question.slice(0,70);}
   audit(s,userId,chatRow.building_id,'messages.insert',assistantId);
  }});
  return createUIMessageStreamResponse({stream});
 }catch(e){return errorResponse(e);}
}
export async function chatStop(_req:Request,params:{id:string}):Promise<Response>{
 const g=await gate();if(g instanceof Response)return g;
 try{
  z.uuid().parse(params.id);
  // The mock answers synchronously inside the POST handler, so there is never a running background run to
  // cancel — this mirrors the real route's 204 once no matching `chat_runs` row is `running`.
  return new Response(null,{status:204});
 }catch(e){return errorResponse(e);}
}
export async function chatStream(_req:Request,params:{id:string}):Promise<Response>{
 const g=await gate();if(g instanceof Response)return g;
 try{
  z.uuid().parse(params.id);
  return new Response(null,{status:204});
 }catch(e){return errorResponse(e);}
}
