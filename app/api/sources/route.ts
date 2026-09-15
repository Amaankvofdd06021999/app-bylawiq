import {z} from 'zod';
import {requireUser,requirePermission} from '@/lib/auth/guards';
import {sameOrigin} from '@/lib/security/origin';
import {rateLimit} from '@/lib/security/rate-limit';
import {allowedUrl} from '@/lib/security/web-source';
import {checkDb,errorResponse} from '@/lib/errors';
import {inngest} from '@/inngest/client';
export async function POST(req:Request){try{const user=await requireUser();sameOrigin(req);const v=z.object({buildingId:z.uuid(),title:z.string().min(1).max(180),url:z.url(),knowledgeBaseId:z.uuid().nullable(),consent:z.literal(true)}).parse(await req.json());await requirePermission(user,'vault.upload',v.buildingId);await rateLimit(v.buildingId,'upload');const url=allowedUrl(v.url).href;const {data,error}=await user.client.from('documents').insert({building_id:v.buildingId,title:v.title,type:'other',source_url:url,knowledge_base_id:v.knowledgeBaseId,uploaded_by:user.id}).select('id').single();checkDb(error);if(!data)throw new Error('Source was not created');await inngest.send({name:'document/ingest',data:{documentId:String(data.id),buildingId:v.buildingId,actorId:user.id}});return Response.json({id:data.id},{status:201});}catch(e){return errorResponse(e);}}
