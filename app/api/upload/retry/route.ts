import {z} from 'zod';
import {requireUser,requirePermission} from '@/lib/auth/guards';
import {sameOrigin} from '@/lib/security/origin';
import {checkDb,errorResponse,AppError} from '@/lib/errors';
import {inngest} from '@/inngest/client';
export async function POST(req:Request){try{const user=await requireUser();sameOrigin(req);const v=z.object({documentId:z.uuid()}).parse(await req.json());const {data,error}=await user.client.from('documents').select('id,building_id,status').eq('id',v.documentId).single();checkDb(error);if(!data)throw new AppError('not_found','This document is unavailable.',404);await requirePermission(user,'vault.upload',data.building_id);if(!['failed','uploaded'].includes(data.status))throw new AppError('already_processing','This document is already processing.');await inngest.send({name:'document/ingest',data:{documentId:data.id,buildingId:data.building_id,actorId:user.id}});return Response.json({ok:true});}catch(e){return errorResponse(e);}}
