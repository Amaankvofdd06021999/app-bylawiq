import {redirect,notFound} from 'next/navigation';
import {buildingWorkspace,conversation} from '@/features/workspace/queries';
import {Shell} from '@/components/shell';
import {Conversation} from '@/features/chat/components/chat-ui';
import type {BylawMessage} from '@/lib/chat-types';
import {UnauthorizedError} from '@/lib/errors';
export const dynamic='force-dynamic';
export default async function ChatPage({params}:{params:Promise<{buildingId:string;chatId:string}>}){const {buildingId,chatId}=await params;const state=await buildingWorkspace(buildingId).catch(e=>{if(e instanceof UnauthorizedError)redirect('/login');throw e;});const {chat,messages}=await conversation(chatId);if(chat.building_id&&chat.building_id!==buildingId)notFound();return <Shell {...state} activeId={buildingId}><Conversation id={chat.id} building={state.building} scope={chat.scope} asOf={chat.as_of} initialMessages={messages as BylawMessage[]}/></Shell>;}
