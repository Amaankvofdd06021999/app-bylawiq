import {notFound} from 'next/navigation';
import {Shell} from '@/components/shell';
import {Resources} from '@/features/workspace/components/resources';
import {Portfolio} from '@/features/workspace/components/portfolio';
import {AskHome,Conversation} from '@/features/chat/components/chat-ui';
import {demoBuilding as building,demoProfile as profile,demoBuildings as buildings,demoData,demoPermissions as permissions,demoConversation} from '@/lib/preview';
export default async function Preview({params}:{params:Promise<{path?:string[]}>}){const {path}=await params;const section=path?.[0]||'ask';if(!['ask','conversation','portfolio','documents','agents','knowledge','bylaws','notices','disputes','updates','members','settings','audit'].includes(section))notFound();return <Shell profile={profile} buildings={buildings} activeId={building.id} preview>{section==='ask'?<AskHome building={building} profile={profile} buildings={buildings} permissions={permissions} documents={demoData.documents} chats={demoData.chats} preview/>:section==='conversation'?<Conversation id="preview" building={building} initialMessages={demoConversation} preview/>:section==='portfolio'?<Portfolio profile={profile} buildings={buildings} preview/>:<Resources building={building} profile={profile} permissions={permissions} section={section} rows={demoData[section]||[]} related={demoData} preview/>}</Shell>;}
