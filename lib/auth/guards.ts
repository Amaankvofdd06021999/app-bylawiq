import 'server-only';
import {db} from '@/lib/supabase/server';
import {ForbiddenError,UnauthorizedError,checkDb} from '@/lib/errors';
export async function requireUser(){const client=await db();const {data,error}=await client.auth.getClaims();if(error||!data?.claims?.sub)throw new UnauthorizedError();return {id:data.claims.sub,email:typeof data.claims.email==='string'?data.claims.email:'',client};}
export type SessionUser=Awaited<ReturnType<typeof requireUser>>;
export async function requirePermission(user:SessionUser,permission:string,buildingId:string){const {data,error}=await user.client.rpc('authorize',{p_permission:permission,p_building:buildingId});checkDb(error);if(data!==true)throw new ForbiddenError();}
