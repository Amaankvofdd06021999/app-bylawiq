import {after} from 'next/server';
import {z} from 'zod';
import {requireUser,requirePermission} from '@/lib/auth/guards';
import {sameOrigin} from '@/lib/security/origin';
import {rateLimit} from '@/lib/security/rate-limit';
import {checkDb,errorResponse,NotFoundError} from '@/lib/errors';
import {chatSchema} from '@/lib/schema';
import {generateAnswer,replayStream} from '@/features/chat/stream';
export const runtime='nodejs';export const maxDuration=300;export const dynamic='force-dynamic';
export async function POST(req:Request){try{const user=await requireUser();sameOrigin(req);const v=z.object({id:z.uuid(),message:z.object({id:z.uuid(),role:z.literal('user'),parts:z.array(z.object({type:z.literal('text'),text:z.string().min(1).max(20000)})).min(1).max(1)})}).parse(await req.json());
 const {data,error}=await user.client.from('chats').select('id,building_id,user_id,title,scope,scope_building_ids,as_of,source_types,agent_deployment_id').eq('id',v.id).single();if(error||!data)throw new NotFoundError();const chat=chatSchema.parse(data);if(chat.building_id)await requirePermission(user,'chat.use',chat.building_id);
 const prior=await user.client.from('chat_runs').select('id').eq('request_id',v.message.id).eq('chat_id',chat.id).maybeSingle();if(prior.data)return replayStream(user,prior.data.id,req.signal);
 await rateLimit(user.id);const history=await user.client.from('messages').select('role,parts').eq('chat_id',chat.id).order('created_at');checkDb(history.error);
 const run=await user.client.from('chat_runs').insert({chat_id:chat.id,request_id:v.message.id}).select('id').single();checkDb(run.error);if(!run.data)throw new NotFoundError();
 checkDb((await user.client.from('messages').insert({id:v.message.id,chat_id:chat.id,role:'user',parts:v.message.parts})).error);
 const priorMessages=z.array(z.object({role:z.enum(['user','assistant']),parts:z.array(z.object({type:z.string(),text:z.string().optional()}).passthrough())})).parse(history.data).map(m=>({role:m.role,text:m.parts.filter(p=>p.type==='text').map(p=>p.text||'').join('\n')}));
 const work=generateAnswer(user,chat,run.data.id,v.message.parts[0].text,priorMessages);after(()=>work);return replayStream(user,run.data.id,req.signal);
 }catch(e){return errorResponse(e);}}
