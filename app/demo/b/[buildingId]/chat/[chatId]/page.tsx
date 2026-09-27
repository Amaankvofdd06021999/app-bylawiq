import {redirect,notFound} from 'next/navigation';
import {demoSession} from '@/mock/session';
import {getStore} from '@/mock/store';
import {layersFor} from '@/mock/rules';
import {buildingWorkspace,conversation} from '@/mock/source';
import {Shell} from '@/components/shell';
import {Conversation} from '@/features/chat/components/chat-ui';
import type {BylawMessage} from '@/lib/chat-types';
import {NotFoundError} from '@/lib/errors';
export const dynamic='force-dynamic';
// Mirrors app/(app)/b/[buildingId]/chat/[chatId]/page.tsx, reading the demo session's store as its person.
export default async function DemoChatPage({params,searchParams}:{params:Promise<{buildingId:string;chatId:string}>;searchParams:Promise<{layers?:string}>}){const session=await demoSession();if(!session)redirect('/demo');const {buildingId,chatId}=await params;const s=getStore(session.sessionId),userId=session.persona.userId;let state:ReturnType<typeof buildingWorkspace>;try{state=buildingWorkspace(s,userId,buildingId);}catch(e){if(e instanceof NotFoundError)redirect('/demo/workspace?notice=access_removed');throw e;}const {chat,messages}=conversation(s,userId,chatId);if(chat.building_id&&chat.building_id!==buildingId)notFound();const available=chat.building_id?layersFor(s,userId,buildingId):undefined;const requested=String((await searchParams).layers||'').split(',');return <Shell {...state} activeId={buildingId}><Conversation id={chat.id} building={state.building} scope={chat.scope} asOf={chat.as_of} initialMessages={messages as BylawMessage[]} availableLayers={available} initialLayers={available?.filter(l=>requested.includes(l))}/></Shell>;}
