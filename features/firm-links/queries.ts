import 'server-only';
import {z} from 'zod';
import {requireUser} from '@/lib/auth/guards';
import {checkDb} from '@/lib/errors';
import {firmLinkStatusSchema} from './schema';
export async function firmLinkStatus(buildingId:string){const user=await requireUser();const {data,error}=await user.client.rpc('building_firm_status',{p_building:buildingId}).maybeSingle();checkDb(error);return data?firmLinkStatusSchema.parse(data):null;}
// Firms the user can act for (accepting a code needs a manager-level firm role), not every organization they can see.
export async function firmOrganizations(){const user=await requireUser();const roles=await user.client.from('org_members').select('org_id').eq('user_id',user.id).eq('status','active').in('role',['org_owner','org_admin','portfolio_manager']);checkDb(roles.error);const ids=z.array(z.object({org_id:z.uuid()})).parse(roles.data).map(r=>r.org_id);if(!ids.length)return [];const {data,error}=await user.client.from('organizations').select('id,name').eq('kind','firm').in('id',ids).order('name');checkDb(error);return z.array(z.object({id:z.uuid(),name:z.string()})).parse(data);}
export async function firmReviewInbox(){const user=await requireUser();const {data,error}=await user.client.from('generated_documents').select('id,building_id,title,kind,created_at').eq('review_by','firm').eq('status','pending_review').is('deleted_at',null).order('created_at').limit(50);checkDb(error);return z.array(z.object({id:z.uuid(),building_id:z.uuid(),title:z.string(),kind:z.string(),created_at:z.string()})).parse(data);}
