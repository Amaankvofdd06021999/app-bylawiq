import {requireUser} from '@/lib/auth/guards';
import {replayStream} from '@/features/chat/stream';
import {errorResponse,checkDb} from '@/lib/errors';
import {z} from 'zod';
export const runtime='nodejs';export const maxDuration=300;export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser();const {id}=z.object({id:z.uuid()}).parse(await params);const {data,error}=await user.client.from('chat_runs').select('id').eq('chat_id',id).eq('status','running').order('created_at',{ascending:false}).limit(1).maybeSingle();checkDb(error);if(!data)return new Response(null,{status:204});return replayStream(user,data.id,req.signal);}catch(e){return errorResponse(e);}}
