import {notFound,redirect} from 'next/navigation';
import {buildingWorkspace,listResource,type Resource} from '@/features/workspace/queries';
import {Shell} from '@/components/shell';
import {Resources} from '@/features/workspace/components/resources';
import {AskHome} from '@/features/chat/components/chat-ui';
import {configured} from '@/lib/env';
import {UnauthorizedError,NotFoundError} from '@/lib/errors';
import {firmLinkStatus} from '@/features/firm-links/queries';
import {StrataManagementCard} from '@/features/firm-links/components/strata-management-card';
export const dynamic='force-dynamic';
export default async function BuildingPage({params,searchParams}:{params:Promise<{buildingId:string;section:string}>;searchParams:Promise<{agent?:string}>}){if(!configured())redirect('/login');const {buildingId,section}=await params;const valid=['ask','documents','bylaws','notices','disputes','updates','agents','knowledge','members','settings','audit'];if(!valid.includes(section))notFound();const state=await buildingWorkspace(buildingId).catch(e=>{if(e instanceof UnauthorizedError)redirect('/login');if(e instanceof NotFoundError)redirect('/workspace?notice=access_removed');throw e;});
 const needed:Resource[]=section==='ask'?['documents','chats']:section==='bylaws'?['bylaws','versions']:section==='documents'||section==='agents'?['documents','knowledge','agents']:section==='knowledge'?['knowledge','documents']:section==='disputes'?['disputes','events']:section==='members'?['members',...(state.permissions.includes('member.invite')?['invitations' as const]:[])]:section==='settings'?[]:section==='notices'?['notices','comments']:[section as Resource];
 const results=await Promise.all(needed.map(async r=>[r,await listResource(r,buildingId)] as const));const related=Object.fromEntries(results);related.organizations=state.organizations;const {agent}=await searchParams;
 const firm=(section==='settings'||section==='notices')&&state.permissions.includes('member.read')?await firmLinkStatus(buildingId):null;
 return <Shell profile={state.profile} buildings={state.buildings} activeId={buildingId} permissions={state.permissions} unreadUpdates={state.unreadUpdates}>{section==='ask'?<AskHome {...state} documents={related.documents||[]} chats={related.chats||[]} agentId={agent||null}/>:<Resources section={section} {...state} rows={related[section]||[]} related={related} firmLinked={firm?.status==='active'}/>}{section==='settings'&&firm&&<div style={{marginTop:24}}><StrataManagementCard buildingId={buildingId} canManage={state.permissions.includes('building.link_firm')} status={firm}/></div>}</Shell>;
}
