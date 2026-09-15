import {z} from 'zod';
import {requireUser,requirePermission} from '@/lib/auth/guards';
import {checkDb,errorResponse,NotFoundError} from '@/lib/errors';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser();const {id}=z.object({id:z.uuid()}).parse(await params);const {data,error}=await user.client.from('documents').select('building_id,storage_path').eq('id',id).single();if(error||!data)throw new NotFoundError();await requirePermission(user,'vault.read',data.building_id);if(!data.storage_path)throw new NotFoundError();const url=await user.client.storage.from('vault').createSignedUrl(data.storage_path,300,{download:true});checkDb(url.error);return Response.redirect(url.data!.signedUrl,302);}catch(e){return errorResponse(e);}}
