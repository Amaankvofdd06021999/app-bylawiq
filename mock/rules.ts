import type {Building,Row} from '@/lib/schema';
import type {MockState} from './store';
import {permissionsFor,type AppRole} from './permissions';
// Pure rule functions shared by `mock/actions.ts` and `mock/source.ts` (later tasks). Every function here is
// the mock equivalent of a Postgres function or RLS policy from supabase/migrations/*.sql, named after it in
// a comment, so scope is enforced the same way in the demo as it is in production (see AGENTS.md §0).
function active(m:Row){if(m.status!=='active')return false;const exp=m.expires_at;return exp==null||new Date(String(exp))>new Date();}
// Mirrors `public.building_members` filtered the way `has_building_access`/`my_building_role` filter it.
export function membership(s:MockState,userId:string,buildingId:string):Row|undefined{return s.members.find(m=>m.user_id===userId&&m.building_id===buildingId&&active(m));}
// Mirrors `public.my_building_role`.
export function roleIn(s:MockState,userId:string,buildingId:string):AppRole|null{const m=membership(s,userId,buildingId);return m?(m.role as AppRole):null;}
// Mirrors `public.authorize`: a permission only holds through an active membership on that building.
export function can(s:MockState,userId:string,permission:string,buildingId:string):boolean{const role=roleIn(s,userId,buildingId);return role!=null&&permissionsFor(role).includes(permission);}
// Mirrors `has_building_access` applied to every building, i.e. the set `workspace()` would return.
export function accessibleBuildings(s:MockState,userId:string):Building[]{const ids=new Set(s.members.filter(m=>m.user_id===userId&&active(m)).map(m=>m.building_id));return s.buildings.filter(b=>ids.has(b.id));}
// Mirrors the `docs_read` policy: `authorize('vault.read',building_id) and (role<>'owner_resident' or owner_visible)`.
export function visibleDocuments(s:MockState,userId:string,buildingId:string):Row[]{
 if(!can(s,userId,'vault.read',buildingId))return [];
 const docs=s.documents.filter(d=>d.building_id===buildingId);
 return roleIn(s,userId,buildingId)==='owner_resident'?docs.filter(d=>d.owner_visible===true):docs;
}
// Mirrors `public.linked_firm_id`.
export function linkedFirmId(s:MockState,buildingId:string):string|null{const link=s.firmLinks.find(l=>l.building_id===buildingId&&l.status==='active');return link?String(link.firm_org_id):null;}
// Mirrors `private.is_linked_member`.
export function isLinkedMember(s:MockState,userId:string,buildingId:string):boolean{
 const m=membership(s,userId,buildingId);
 if(!m||m.via_link_id==null)return false;
 return s.firmLinks.some(l=>l.id===m.via_link_id&&l.status==='active');
}
// Mirrors `public.can_assign`: which roles the caller's own role may hand out or take away on that building.
export function canAssign(s:MockState,userId:string,buildingId:string,r:string):boolean{
 switch(roleIn(s,userId,buildingId)){
  case 'org_owner':return r!=='org_owner';
  case 'org_admin':return !['org_owner','org_admin'].includes(r);
  case 'portfolio_manager':return ['portfolio_assistant','building_manager','council_president','council_member','external_counsel','owner_resident'].includes(r);
  case 'building_manager':case 'council_president':return ['council_member','external_counsel'].includes(r);
  default:return false;
 }
}
