import {requireUser} from '@/lib/auth/guards';
import {sameOrigin} from '@/lib/security/origin';
import {errorResponse,checkDb} from '@/lib/errors';
import {z} from 'zod';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser();sameOrigin(req);const {id}=z.object({id:z.uuid()}).parse(await params);checkDb((await user.client.from('chat_runs').update({cancel_requested:true}).eq('chat_id',id).eq('status','running')).error);return Response.json({ok:true});}catch(e){return errorResponse(e);}}
