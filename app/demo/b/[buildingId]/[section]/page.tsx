import {notFound,redirect} from 'next/navigation';
import {demoSession} from '@/mock/session';
import {getStore} from '@/mock/store';
import {isPlatformAdmin,layersFor} from '@/mock/rules';
import {buildingWorkspace,listResource,firmLinkStatus,type Resource} from '@/mock/source';
import {buildingManagerDashboard,hasBuildingHome} from '@/mock/dashboards';
import {hasResidentHome,residentData} from '@/mock/residents';
import {firmKnowledgeView,firmTabFor} from '@/mock/mutations/firm-knowledge';
import {Shell} from '@/components/shell';
import {Resources} from '@/features/workspace/components/resources';
import {AskHome} from '@/features/chat/components/chat-ui';
import {NotFoundError} from '@/lib/errors';
import type {Row} from '@/lib/schema';
import {StrataManagementCard} from '@/features/firm-links/components/strata-management-card';
import {BuildingManagerDashboard} from '@/features/dashboards/components/building-manager';
import {ResidentHome} from '@/features/residents/components/resident-home';
import {Explainers} from '@/features/residents/components/explainers';
import {DraftNotice} from '@/features/residents/components/draft-notice';
import {ReplyLetter} from '@/features/residents/components/reply-letter';
import {MyDrafts} from '@/features/residents/components/my-drafts';
import {CreditsPage} from '@/features/residents/components/credits-card';
import {FirmKnowledge,KnowledgeTabs} from '@/features/knowledge/components/firm-knowledge';
export const dynamic='force-dynamic';
// Mirrors app/(app)/b/[buildingId]/[section]/page.tsx, reading the demo session's store as its person. Demo-only
// sections: `home` (the building dashboard for staff with Ask, the resident home for a resident), and the paying
// resident's own tools — `explainers`, `draft`, `reply`, `my-drafts`, `credits` — which are a 404 for anyone who
// isn't a resident of this building. `knowledge` gains a Firm tab for the linked firm's staff only. The platform
// admin has no buildings and goes to /demo/admin.
const RESIDENT_SECTIONS=['explainers','draft','reply','my-drafts','credits'];
export default async function DemoBuildingPage({params,searchParams}:{params:Promise<{buildingId:string;section:string}>;searchParams:Promise<{agent?:string;scope?:string;tab?:string;collection?:string}>}){const session=await demoSession();if(!session)redirect('/demo');const {buildingId,section}=await params;const valid=['home','ask','documents','bylaws','notices','disputes','updates','agents','knowledge','members','settings','audit',...RESIDENT_SECTIONS];if(!valid.includes(section))notFound();const s=getStore(session.sessionId),userId=session.persona.userId;if(isPlatformAdmin(s,userId))redirect('/demo/admin');let state:ReturnType<typeof buildingWorkspace>;try{state=buildingWorkspace(s,userId,buildingId);}catch(e){if(e instanceof NotFoundError)redirect('/demo/workspace?notice=access_removed');throw e;}
 const resident=hasResidentHome(s,userId,buildingId);
 const home=state.profile.account_type==='single_building'&&hasBuildingHome(s,userId,buildingId);
 const shell={profile:state.profile,buildings:state.buildings,activeId:buildingId,permissions:state.permissions,unreadUpdates:state.unreadUpdates,home,residentNav:resident};
 if(resident&&(section==='home'||RESIDENT_SECTIONS.includes(section))){
  const data=residentData(s,userId,buildingId);
  const view=section==='explainers'?<Explainers data={data}/>:section==='draft'?<DraftNotice data={data}/>:section==='reply'?<ReplyLetter data={data}/>:section==='my-drafts'?<MyDrafts data={data}/>:section==='credits'?<CreditsPage data={data}/>:<ResidentHome data={data}/>;
  return <Shell {...shell}>{view}</Shell>;
 }
 if(RESIDENT_SECTIONS.includes(section))notFound();
 if(section==='home'){
  if(!hasBuildingHome(s,userId,buildingId))redirect(`/demo/b/${buildingId}/documents`);
  const status=firmLinkStatus(s,userId,buildingId);
  return <Shell {...shell}><BuildingManagerDashboard data={buildingManagerDashboard(s,userId,buildingId)} firmCard={status&&<StrataManagementCard buildingId={buildingId} canManage={state.permissions.includes('building.link_firm')} status={status}/>}/></Shell>;
 }
 const {agent,scope,tab,collection}=await searchParams;
 // The Firm tab: only for staff of the firm this building is linked to. Anyone else asking for it gets the
 // building tab, with no hint that firm knowledge exists.
 const firmTab=section==='knowledge'&&firmTabFor(s,userId,buildingId);
 if(firmTab&&tab==='firm')return <Shell {...shell}><KnowledgeTabs buildingId={buildingId} active="firm"/><FirmKnowledge data={firmKnowledgeView(s,userId)} initialCollection={collection}/></Shell>;
 const needed:Resource[]=section==='ask'?['documents','chats']:section==='bylaws'?['bylaws','versions']:section==='documents'||section==='agents'?['documents','knowledge','agents']:section==='knowledge'?['knowledge','documents']:section==='disputes'?['disputes','events']:section==='members'?['members',...(state.permissions.includes('member.invite')?['invitations' as const]:[])]:section==='settings'?[]:section==='notices'?['notices','comments']:[section as Resource];
 const related:Record<string,Row[]>=Object.fromEntries(needed.map(r=>[r,listResource(s,userId,r,buildingId)] as const));related.organizations=state.organizations;
 const firm=(section==='settings'||section==='notices')&&state.permissions.includes('member.read')?firmLinkStatus(s,userId,buildingId):null;
 return <Shell {...shell}>{firmTab&&<KnowledgeTabs buildingId={buildingId} active="building"/>}{section==='ask'?<AskHome {...state} documents={related.documents||[]} chats={related.chats||[]} agentId={agent||null} availableLayers={layersFor(s,userId,buildingId)} initialScope={scope==='portfolio'?'portfolio':undefined}/>:<Resources section={section} {...state} rows={related[section]||[]} related={related} firmLinked={firm?.status==='active'}/>}{section==='settings'&&firm&&<div style={{marginTop:24}}><StrataManagementCard buildingId={buildingId} canManage={state.permissions.includes('building.link_firm')} status={firm}/></div>}</Shell>;
}
