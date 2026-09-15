import 'server-only';
import {requireUser} from '@/lib/auth/guards';
import {buildingSchema,profileSchema,rowSchema,chatSchema} from '@/lib/schema';
import {checkDb,NotFoundError} from '@/lib/errors';
import {z} from 'zod';
export async function workspace(){const user=await requireUser();const responses=await Promise.all([
 user.client.from('profiles').select('id,display_name,account_type,bound_building_id').eq('id',user.id).single(),
 user.client.from('buildings').select('id,org_id,name,strata_plan_no,address,unit_count,municipality,corpus_version,jurisdiction_chain').order('name'),
 user.client.from('organizations').select('id,name,plan,letterhead,signature_block'),
 user.client.from('building_members').select('id,building_id,role,status,expires_at').eq('user_id',user.id).eq('status','active'),
 ]);responses.forEach(r=>checkDb(r.error));return {profile:profileSchema.parse(responses[0].data),buildings:z.array(buildingSchema).parse(responses[1].data),organizations:z.array(rowSchema).parse(responses[2].data),memberships:z.array(rowSchema).parse(responses[3].data),email:user.email};}
const resources={
 documents:['documents','id,building_id,title,type,status,error_message,effective_date,lto_filing_ref,created_at,byte_size,source_url,knowledge_base_id,parsed_sections,structure_confirmed'],
 agents:['agents','id,building_id,name,description,instructions,status,knowledge_base_id,include_legal,top_k,created_at'],
 knowledge:['knowledge_bases','id,building_id,name,description,created_at'],
 bylaws:['bylaw_nodes','id,building_id,title,section_ref,set_id,created_at'],
 versions:['bylaw_versions','id,building_id,node_id,version,body,rationale,status,effective_date,filing_reference,created_by,review_choice,created_at'],
 notices:['generated_documents','id,building_id,kind,title,body_md,status,created_by,approved_by,approved_at,sent_at,dispute_id,created_at'],
 disputes:['disputes','id,building_id,title,reference,category,subject_unit,stage,created_at'],
 events:['dispute_events','id,building_id,dispute_id,stage,occurred_at,logged_at,summary,actor_id'],
 updates:['notifications','id,building_id,type,title,body,severity,target_id,state,snoozed_until,created_at'],
 members:['building_members','id,building_id,user_id,role,status,expires_at'],
 invitations:['invitations','id,building_id,email,role,expires_at,accepted_at,revoked_at,created_at'],
 audit:['audit_log','id,building_id,action,target_id,occurred_at,actor_id'],
 chats:['chats','id,building_id,title,scope,updated_at,archived'],
 deployments:['agent_deployments','id,building_id,agent_id,version,config,created_at'],
} as const;
export type Resource=keyof typeof resources;
export async function listResource(resource:Resource,buildingId:string){const user=await requireUser();const table:string=resources[resource][0];const columns:string=resources[resource][1];const {data,error}=await user.client.from(table).select(columns).eq('building_id',buildingId).limit(250);checkDb(error);return z.array(resource==='audit'?rowSchema.extend({id:z.union([z.string(),z.number()]).transform(String)}):rowSchema).parse(data);}
export async function buildingWorkspace(buildingId:string){const state=await workspace();const building=state.buildings.find(b=>b.id===buildingId);if(!building)throw new NotFoundError();const user=await requireUser();const {data:membership,error}=await user.client.rpc('my_building_role',{p_building:buildingId});checkDb(error);const {data:permissions,error:e}=await user.client.from('role_permissions').select('permission').eq('role',membership);checkDb(e);return {...state,building,permissions:z.array(z.object({permission:z.string()})).parse(permissions).map(p=>p.permission)};}
export async function conversation(chatId:string){const user=await requireUser();const {data,error}=await user.client.from('chats').select('id,building_id,user_id,title,scope,scope_building_ids,as_of,source_types,agent_deployment_id').eq('id',chatId).single();if(error||!data)throw new NotFoundError();const chat=chatSchema.parse(data);const {data:messages,error:me}=await user.client.from('messages').select('id,role,parts').eq('chat_id',chatId).order('created_at');checkDb(me);return {chat,messages:z.array(z.object({id:z.string(),role:z.enum(['user','assistant']),parts:z.array(z.unknown())})).parse(messages)};}
