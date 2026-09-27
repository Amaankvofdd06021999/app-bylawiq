import 'server-only';
import {z} from 'zod';
import {requireUser} from '@/lib/auth/guards';
import {checkDb} from '@/lib/errors';
import {firmLinkStatusSchema} from './schema';
export async function firmLinkStatus(buildingId:string){const user=await requireUser();const {data,error}=await user.client.rpc('building_firm_status',{p_building:buildingId}).maybeSingle();checkDb(error);return data?firmLinkStatusSchema.parse(data):null;}
export async function firmOrganizations(){const user=await requireUser();const {data,error}=await user.client.from('organizations').select('id,name').eq('kind','firm').order('name');checkDb(error);return z.array(z.object({id:z.uuid(),name:z.string()})).parse(data);}
export async function firmReviewInbox(){const user=await requireUser();const {data,error}=await user.client.from('generated_documents').select('id,building_id,title,kind,created_at').eq('review_by','firm').eq('status','pending_review').is('deleted_at',null).order('created_at').limit(50);checkDb(error);return z.array(z.object({id:z.uuid(),building_id:z.uuid(),title:z.string(),kind:z.string(),created_at:z.string()})).parse(data);}
