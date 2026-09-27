import {notFound,redirect} from 'next/navigation';
import {demoSession} from '@/mock/session';
import {getStore} from '@/mock/store';
import {isPlatformAdmin,layersFor} from '@/mock/rules';
import {buildingWorkspace,listResource,firmLinkStatus,type Resource} from '@/mock/source';
import {buildingManagerDashboard,hasBuildingHome} from '@/mock/dashboards';
import {Shell} from '@/components/shell';
import {Resources} from '@/features/workspace/components/resources';
import {AskHome} from '@/features/chat/components/chat-ui';
import {NotFoundError} from '@/lib/errors';
import type {Row} from '@/lib/schema';
import {StrataManagementCard} from '@/features/firm-links/components/strata-management-card';
import {BuildingManagerDashboard} from '@/features/dashboards/components/building-manager';
export const dynamic='force-dynamic';
// Mirrors app/(app)/b/[buildingId]/[section]/page.tsx, reading the demo session's store as its person. `home` is
// demo-only (the real app has no building home yet): the building dashboard for staff with Ask; a resident's home
// falls back to documents until Task 4 adds it. The platform admin has no buildings and goes to /demo/admin.
export default async function DemoBuildingPage({params,searchParams}:{params:Promise<{buildingId:string;section:string}>;searchParams:Promise<{agent?:string;scope?:string}>}){const session=await demoSession();if(!session)redirect('/demo');const {buildingId,section}=await params;const valid=['home','ask','documents','bylaws','notices','disputes','updates','agents','knowledge','members','settings','audit'];if(!valid.includes(section))notFound();const s=getStore(session.sessionId),userId=session.persona.userId;if(isPlatformAdmin(s,userId))redirect('/demo/admin');let state:ReturnType<typeof buildingWorkspace>;try{state=buildingWorkspace(s,userId,buildingId);}catch(e){if(e instanceof NotFoundError)redirect('/demo/workspace?notice=access_removed');throw e;}
 const home=state.profile.account_type==='single_building'&&hasBuildingHome(s,userId,buildingId);
 const shell={profile:state.profile,buildings:state.buildings,activeId:buildingId,permissions:state.permissions,unreadUpdates:state.unreadUpdates,home};
 if(section==='home'){
  if(!hasBuildingHome(s,userId,buildingId))redirect(`/demo/b/${buildingId}/documents`);
  const status=firmLinkStatus(s,userId,buildingId);
  return <Shell {...shell}><BuildingManagerDashboard data={buildingManagerDashboard(s,userId,buildingId)} firmCard={status&&<StrataManagementCard buildingId={buildingId} canManage={state.permissions.includes('building.link_firm')} status={status}/>}/></Shell>;
 }
 const needed:Resource[]=section==='ask'?['documents','chats']:section==='bylaws'?['bylaws','versions']:section==='documents'||section==='agents'?['documents','knowledge','agents']:section==='knowledge'?['knowledge','documents']:section==='disputes'?['disputes','events']:section==='members'?['members',...(state.permissions.includes('member.invite')?['invitations' as const]:[])]:section==='settings'?[]:section==='notices'?['notices','comments']:[section as Resource];
 const related:Record<string,Row[]>=Object.fromEntries(needed.map(r=>[r,listResource(s,userId,r,buildingId)] as const));related.organizations=state.organizations;const {agent,scope}=await searchParams;
 const firm=(section==='settings'||section==='notices')&&state.permissions.includes('member.read')?firmLinkStatus(s,userId,buildingId):null;
 return <Shell {...shell}>{section==='ask'?<AskHome {...state} documents={related.documents||[]} chats={related.chats||[]} agentId={agent||null} availableLayers={layersFor(s,userId,buildingId)} initialScope={scope==='portfolio'?'portfolio':undefined}/>:<Resources section={section} {...state} rows={related[section]||[]} related={related} firmLinked={firm?.status==='active'}/>}{section==='settings'&&firm&&<div style={{marginTop:24}}><StrataManagementCard buildingId={buildingId} canManage={state.permissions.includes('building.link_firm')} status={firm}/></div>}</Shell>;
}
