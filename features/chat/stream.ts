import 'server-only';
import {createHmac} from 'node:crypto';
import {streamText,Output,UI_MESSAGE_STREAM_HEADERS,type UIMessageChunk} from 'ai';
import {z} from 'zod';
import type {SessionUser} from '@/lib/auth/guards';
import {requirePermission} from '@/lib/auth/guards';
import {chatSchema} from '@/lib/schema';
import {secret} from '@/lib/env';
import {checkDb,AppError} from '@/lib/errors';
import {answerSchema,validateCitations,NO_GROUNDING} from '@/lib/ai/citations';
import {MODELS,MODEL_IDS} from '@/lib/ai/models';
import {DISCLAIMER} from '@/lib/constants';
import {SYSTEM_PROMPT} from './prompts';
import {retrieve} from './retrieval';
export async function generateAnswer(user:SessionUser,chat:z.infer<typeof chatSchema>,runId:string,question:string,history:{role:'user'|'assistant';text:string}[]){
 const id=crypto.randomUUID();const parts:unknown[]=[];const publication:UIMessageChunk[]=[];let completed=false;const abort=new AbortController();
 const cancellation=setInterval(async()=>{const {data}=await user.client.from('chat_runs').select('cancel_requested').eq('id',runId).maybeSingle();if(!data||data.cancel_requested)abort.abort();},1500);
 const timeout=setTimeout(()=>abort.abort(),240000);
 async function emit(event:UIMessageChunk){const {error}=await user.client.from('stream_events').insert({run_id:runId,event});checkDb(error);}
 async function progress(label:string){await emit({type:'data-progress',data:{label},transient:true});}
 async function text(value:string){await emit({type:'text-start',id:'answer'});await emit({type:'text-delta',id:'answer',delta:value});await emit({type:'text-end',id:'answer'});parts.push({type:'text',text:value});}
 try{
  const signingSecret=secret('SERVER_SIGNING_SECRET');
  await emit({type:'start',messageId:id});await progress('Searching the selected sources…');
  const result=await retrieve(user,chat,question);if(abort.signal.aborted)throw new AppError('cancelled','Generation stopped.');
  if(!result.sources.length){const value=NO_GROUNDING+'\n\n'+DISCLAIMER;parts.push({type:'text',text:value});publication.push({type:'text-start',id:'answer'},{type:'text-delta',id:'answer',delta:value},{type:'text-end',id:'answer'});}
  else{
   secret('ANTHROPIC_API_KEY');await progress('Preparing a source-grounded draft…');
   const generated=streamText({model:MODELS.answer,system:SYSTEM_PROMPT,output:Output.object({schema:answerSchema}),messages:[...history.slice(-16).map(m=>({role:m.role,content:m.text})),{role:'user',content:JSON.stringify({question,scope:chat.scope,asOf:chat.as_of,agentPurpose:result.instruction,sources:result.sources})}],maxOutputTokens:4500,abortSignal:abort.signal});
   // Consume the actual model stream. No legal text is released before N2 validates it.
   for await(const part of generated.textStream){void part;if(abort.signal.aborted)break;}
   const answer=await generated.output;await progress('Verifying citations and source quotations…');
   if(!validateCitations(answer,result.sources))throw new AppError('citation_rejected','The draft did not pass source verification. No legal answer was released. Try a more specific question.');
   // Revalidate live scope immediately before publishing the grounded output.
   for(const b of chat.scope==='portfolio'?chat.scope_building_ids:chat.building_id?[chat.building_id]:[])await requirePermission(user,'chat.use',b);
   const payload={answer,sources:result.sources};publication.push({type:'data-answer',id:'grounded-answer',data:payload});parts.push({type:'data-answer',id:'grounded-answer',data:payload});
   const readable=['ANSWER',...answer.answer.map(c=>c.text+' '+c.evidence.map(e=>'['+e.source+']').join(' ')),'\nBASIS',...answer.basis.map(c=>c.text+' '+c.evidence.map(e=>'['+e.source+']').join(' ')),'\nNEXT STEPS',...answer.nextSteps.map(c=>c.text+' '+c.evidence.map(e=>'['+e.source+']').join(' ')),answer.limitations,DISCLAIMER].join('\n');
   parts.push({type:'text',text:readable});
   checkDb((await user.client.from('retrieval_traces').insert({chat_id:chat.id,candidate_ids:result.candidateIds,used_ids:result.sources.map(s=>s.chunkId),corpus_versions:result.versions})).error);
  }
  if(abort.signal.aborted)throw new AppError('cancelled','Generation stopped.');
  const serialized=JSON.stringify(parts);const signature=createHmac('sha256',signingSecret).update(chat.id+':'+id+':'+serialized).digest('hex');
  checkDb((await user.client.rpc('append_verified_message',{p_chat:chat.id,p_id:id,p_parts:serialized,p_model:MODEL_IDS.answer,p_signature:signature})).error);
  const grounded=parts.find((p):p is {type:string;data:{answer:z.infer<typeof answerSchema>;sources:typeof result.sources}}=>typeof p==='object'&&p!==null&&'type' in p&&p.type==='data-answer');
  if(grounded){const evidence=[...grounded.data.answer.answer,...grounded.data.answer.basis,...grounded.data.answer.nextSteps].flatMap(c=>c.evidence);const unique=[...new Map(evidence.map(e=>[e.source,e])).values()];for(const e of unique){const s=result.sources.find(s=>s.id===e.source)!;checkDb((await user.client.from('message_citations').insert({message_id:id,ordinal:s.id,kind:s.kind,document_chunk_id:s.kind==='building'?s.chunkId:null,legal_chunk_id:s.kind==='legal'?s.chunkId:null,quoted_span:e.quote})).error);}}
  checkDb((await user.client.from('chats').update({updated_at:new Date().toISOString(),...(chat.title==='New conversation'?{title:question.slice(0,70)}:{})}).eq('id',chat.id)).error);
  for(const event of publication)await emit(event);
  await emit({type:'finish',finishReason:'stop'});completed=true;
 }catch(e){const message=abort.signal.aborted?'Generation stopped. Your question remains in the conversation.':e instanceof AppError?e.message:'The answer service is unavailable. Your conversation has been saved.';try{await text(message);await emit({type:'finish',finishReason:'error'});}catch{/* Membership may have been revoked. No further writes are permitted. */}}
 finally{clearInterval(cancellation);clearTimeout(timeout);await user.client.from('chat_runs').update({status:completed?'complete':abort.signal.aborted?'cancelled':'failed',heartbeat_at:new Date().toISOString()}).eq('id',runId);}
}
export function replayStream(user:SessionUser,runId:string,signal:AbortSignal){
 let cursor=0;let closed=false;const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({async start(controller){try{const start=Date.now();while(!signal.aborted&&!closed&&Date.now()-start<260000){
  const run=await user.client.from('chat_runs').select('status,created_at').eq('id',runId).maybeSingle();if(run.error||!run.data)break;
  const result=await user.client.from('stream_events').select('id,event').eq('run_id',runId).gt('id',cursor).order('id').limit(100);checkDb(result.error);
  for(const row of result.data||[]){if(closed)break;cursor=Number(row.id);controller.enqueue(encoder.encode('data: '+JSON.stringify(row.event)+'\n\n'));}
  if(run.data.status!=='running')break;
  if(Date.now()-new Date(run.data.created_at).getTime()>300000){await user.client.from('chat_runs').update({status:'failed'}).eq('id',runId);break;}
  await new Promise(resolve=>setTimeout(resolve,700));
 }if(!closed){controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();closed=true;}}catch{if(!closed){controller.close();closed=true;}}},cancel(){closed=true;}});
 return new Response(stream,{headers:{...UI_MESSAGE_STREAM_HEADERS,'Cache-Control':'private, no-store','X-Accel-Buffering':'no'}});
}
