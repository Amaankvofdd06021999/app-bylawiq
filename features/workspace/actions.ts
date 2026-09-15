'use server';
import {createHash,randomBytes} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {requireUser,requirePermission} from '@/lib/auth/guards';
import {mutationSchema,values} from './schema';
import {checkDb,errorMessage,AppError} from '@/lib/errors';
import {z} from 'zod';
const permissions:Record<string,string>={'building.create':'building.create','building.update':'building.update','building.archive':'building.delete','knowledge.save':'agent.manage','knowledge.delete':'agent.manage','agent.save':'agent.manage','agent.deploy':'agent.deploy','agent.pause':'agent.deploy','agent.delete':'agent.manage','document.update':'vault.upload','document.delete':'vault.delete','document.confirm':'vault.upload','bylaw.save':'bylaw.edit','bylaw.transition':'bylaw.adopt','notice.save':'document.draft','notice.transition':'chat.use','dispute.save':'dispute.create','dispute.event':'dispute.update','update.state':'chat.use','member.change':'member.update_role','member.invite':'member.invite','org.update':'building.update','invite.revoke':'member.invite','chat.rename':'chat.use','chat.archive':'chat.use'};
export async function mutateAction(raw:unknown):Promise<{ok:true;id?:string;url?:string}|{ok:false;error:string}>{
 try{
  const user=await requireUser();const input=mutationSchema.parse(raw);await requirePermission(user,permissions[input.operation],input.buildingId);
  const db=user.client;const b=input.buildingId;let result:{data:unknown;error:{code?:string;message:string}|null};let link:string|undefined;
  const requiredId=()=>z.uuid().parse(input.id);
  // Validate record identity against the selected building, including RPC targets.
  const scopedTables:Record<string,string>={knowledge:'knowledge_bases',agent:'agents',document:'documents',bylaw:'bylaw_versions',notice:'generated_documents',dispute:'disputes',update:'notifications',member:'building_members',invite:'invitations',chat:'chats'};
  async function scopedRecord(table:string,id:string){const record=await db.from(table).select('id').eq('id',id).eq('building_id',b).maybeSingle();checkDb(record.error);if(!record.data)throw new AppError('not_found','This record is unavailable in the selected building.',404);}
  const scopedTable=scopedTables[input.operation.split('.')[0]];
  if(input.id&&scopedTable)await scopedRecord(scopedTable,input.id);
  if(input.operation==='bylaw.save'&&input.values.nodeId)await scopedRecord('bylaw_nodes',z.uuid().parse(input.values.nodeId));
  if((input.operation==='dispute.event'||input.operation==='notice.save')&&input.values.disputeId)await scopedRecord('disputes',z.uuid().parse(input.values.disputeId));
  if(input.operation==='agent.save'&&input.values.knowledgeBaseId)await scopedRecord('knowledge_bases',z.uuid().parse(input.values.knowledgeBaseId));
  switch(input.operation){
   case 'building.create':{const v=values.building.parse(input.values);result=await db.rpc('create_building',{p_org_id:v.orgId,p_name:v.name,p_plan:v.plan,p_address:v.address,p_units:v.units});break;}
   case 'building.update':{const v=values.building.parse(input.values);result=await db.from('buildings').update({name:v.name,address:v.address,unit_count:v.units}).eq('id',b);break;}
   case 'building.archive':result=await db.rpc('archive_building',{p_id:b});break;
   case 'knowledge.save':{const v=values.knowledge.parse(input.values);result=input.id?await db.from('knowledge_bases').update(v).eq('id',input.id).eq('building_id',b):await db.from('knowledge_bases').insert({...v,building_id:b}).select('id').single();break;}
   case 'knowledge.delete':result=await db.from('knowledge_bases').update({deleted_at:new Date().toISOString()}).eq('id',requiredId()).eq('building_id',b);break;
   case 'agent.save':{const v=values.agent.parse(input.values);const data={name:v.name,description:v.description,instructions:v.instructions,knowledge_base_id:v.knowledgeBaseId||null,include_legal:v.includeLegal,top_k:v.topK};result=input.id?await db.from('agents').update(data).eq('id',input.id).eq('building_id',b):await db.from('agents').insert({...data,building_id:b,created_by:user.id}).select('id').single();break;}
   case 'agent.deploy':result=await db.rpc('deploy_agent',{p_id:requiredId()});break;
   case 'agent.pause':result=await db.rpc('pause_agent',{p_id:requiredId()});break;
   case 'agent.delete':result=await db.from('agents').update({deleted_at:new Date().toISOString()}).eq('id',requiredId()).eq('building_id',b);break;
   case 'document.update':{const v=values.document.parse(input.values);result=await db.from('documents').update({title:v.title,type:v.type,effective_date:v.effectiveDate||null,lto_filing_ref:v.filingReference||null}).eq('id',requiredId()).eq('building_id',b);break;}
   case 'document.delete':result=await db.rpc('delete_document',{p_id:requiredId()});break;
   case 'document.confirm':result=await db.rpc('confirm_document_structure',{p_id:requiredId()});break;
   case 'bylaw.save':{const v=values.bylaw.parse(input.values);result=await db.rpc('save_bylaw',{p_building_id:b,p_node_id:v.nodeId||null,p_title:v.title,p_section:v.section,p_body:v.body,p_rationale:v.rationale});break;}
   case 'bylaw.transition':{const v=values.transition.parse(input.values);result=await db.rpc('transition_bylaw',{p_id:requiredId(),p_status:v.status,p_review:v.review,p_filing:v.filing,p_effective:v.effective,p_for:v.for,p_against:v.against,p_abstain:v.abstain,p_override:v.override});break;}
   case 'notice.save':{const v=values.notice.parse(input.values);result=input.id?await db.rpc('save_artifact',{p_id:input.id,p_title:v.title,p_body:v.body}):await db.from('generated_documents').insert({building_id:b,title:v.title,kind:v.kind,body_md:v.body,created_by:user.id,dispute_id:v.disputeId||null}).select('id').single();break;}
   case 'notice.transition':{const v=z.object({status:z.enum(['pending_review','approved','sent','void']),occurredAt:z.iso.datetime().nullable().default(null),confirmed:z.literal(true)}).parse(input.values);result=await db.rpc('transition_artifact',{p_id:requiredId(),p_status:v.status,p_occurred_at:v.occurredAt});break;}
   case 'dispute.save':{const v=values.dispute.parse(input.values);result=input.id?await db.from('disputes').update({title:v.title,category:v.category,subject_unit:v.unit}).eq('id',input.id).eq('building_id',b):await db.from('disputes').insert({building_id:b,title:v.title,category:v.category,subject_unit:v.unit,reference:'D-'+new Date().getFullYear()+'-'+randomBytes(3).toString('hex').toUpperCase(),opened_by:user.id}).select('id').single();break;}
   case 'dispute.event':{const v=values.event.parse(input.values);result=await db.rpc('log_dispute_event',{p_dispute_id:v.disputeId,p_stage:v.stage,p_occurred_at:v.occurredAt,p_summary:v.summary,p_key:v.key});break;}
   case 'update.state':{const v=values.notification.parse(input.values);result=await db.rpc('update_notification',{p_id:requiredId(),p_state:v.state,p_reason:v.reason,p_until:v.until});break;}
   case 'member.change':{const v=values.member.parse(input.values);result=await db.rpc('change_membership',{p_id:requiredId(),p_role:v.role,p_remove:v.remove});break;}
   case 'member.invite':{const v=values.invite.parse(input.values);const token=randomBytes(32).toString('hex');result=await db.rpc('create_invitation',{p_building:b,p_email:v.email,p_role:v.role,p_hash:createHash('sha256').update(token).digest('hex'),p_expires:v.expiresAt});link=(process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000')+'/invite/'+token;break;}
   case 'invite.revoke':result=await db.rpc('revoke_invitation',{p_id:requiredId()});break;
   case 'org.update':{const v=z.object({name:z.string().min(2).max(120),letterhead:z.string().max(2000),signature_block:z.string().max(1000),orgId:z.uuid()}).parse(input.values);result=await db.from('organizations').update({name:v.name,letterhead:v.letterhead,signature_block:v.signature_block}).eq('id',v.orgId);break;}
   case 'chat.rename':result=await db.from('chats').update({title:z.string().min(1).max(150).parse(input.values.title)}).eq('id',requiredId()).eq('building_id',b);break;
   case 'chat.archive':result=await db.from('chats').update({archived:true}).eq('id',requiredId()).eq('building_id',b);break;
   default:throw new AppError('invalid_operation','Choose a valid action.');
  }
  checkDb(result.error);revalidatePath('/workspace','layout');revalidatePath('/b','layout');const data=result.data;return {ok:true,id:typeof data==='string'?data:data&&typeof data==='object'&&'id' in data?String(data.id):undefined,url:link};
 }catch(e){return {ok:false,error:errorMessage(e)};}
}
